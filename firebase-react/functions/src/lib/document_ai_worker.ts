import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { DocumentProcessorServiceClient } from "@google-cloud/documentai";
import { logOpsEvent } from "./ops_audit";

// Document AI 클라이언트 초기화 (런타임에 지연 초기화 가능)
let client: DocumentProcessorServiceClient | null = null;

// EP-09-03: 민감 개인정보 마스킹 유틸리티
const maskSensitiveInfo = (type: string, value: string): string => {
  if (!value) return value;
  const lowerType = type.toLowerCase();
  
  // 주민등록번호 마스킹 (예: 123456-1234567 -> 123456-1******)
  if (lowerType.includes("jumin") || lowerType.includes("resident") || lowerType.includes("id_number")) {
    return value.replace(/(\d{6})[- ]?(\d{7})/, "$1-*******");
  }
  // 전화번호/휴대폰번호 마스킹 (예: 010-1234-5678 -> 010-****-5678)
  if (lowerType.includes("phone") || lowerType.includes("mobile")) {
    return value.replace(/(\d{2,3})[- ]?(\d{3,4})[- ]?(\d{4})/, "$1-****-$3");
  }
  // 이메일 마스킹 (예: abcd@gmail.com -> ab**@gmail.com)
  if (lowerType.includes("email")) {
    return value.replace(/(?<=^.{2}).*(?=@)/, (match) => "*".repeat(match.length));
  }
  
  return value;
};

export const processDocumentAI = async (
  adminInstance: typeof admin,
  object: functions.storage.ObjectMetadata
) => {
  const { bucket, name: filePath, contentType } = object;

  if (!filePath) {
    return;
  }

  // 1. 파일 경로 필터링 (예: cases/{caseId}/documents/{docId}_{filename})
  // 임시로 cases/ 경로의 파일만 처리하도록 제한합니다.
  if (!filePath.startsWith("cases/")) return;

  // 이미지나 PDF가 아닌 경우 OCR 처리 안함
  if (!contentType?.startsWith("image/") && contentType !== "application/pdf") {
    return;
  }

  console.log(`[DocumentAI] 문서 분석 시작: gs://${bucket}/${filePath}`);

  if (!client) {
    client = new DocumentProcessorServiceClient();
  }

  // 2. 프로젝트 및 Document AI 프로세서 정보 
  const isProd = process.env.FUNCTIONS_EMULATOR !== "true" && process.env.NODE_ENV === "production";
  const projectId = process.env.GCLOUD_PROJECT || "agent-eregi";
  const location = process.env.DOCUMENT_AI_LOCATION || "us"; 
  let processorId = process.env.DOCUMENT_AI_PROCESSOR_ID;

  if (!processorId) {
    if (isProd) {
      throw new Error("운영 환경에서 DOCUMENT_AI_PROCESSOR_ID 환경변수가 설정되지 않았습니다.");
    }
    console.warn(`[DocumentAI] 프로세서 ID 누락. 로컬/테스트 환경이므로 Mock 모드로 동작합니다.`);
    processorId = "mock-processor-id";
  }

  const processorName = `projects/${projectId}/locations/${location}/processors/${processorId}`;
  
  // Storage 파일 버퍼 다운로드 (GCS URI 직접 전달 시 권한 문제가 있을 수 있어 버퍼로 전달)
  const fileBucket = adminInstance.storage().bucket(bucket);
  const [fileContent] = await fileBucket.file(filePath).download();

  const request = {
    name: processorName,
    rawDocument: {
      content: fileContent.toString("base64"),
      mimeType: contentType,
    },
  };

  try {
    // 3. Document AI API 호출
    let extractedData: Record<string, any> = {};
    let isDefective = false;
    const defectReasons: string[] = [];

    if (processorId !== "mock-processor-id") {
      const [result] = await client.processDocument(request);
      const document = result.document;

      let hasSignatureOrSeal = false; // EP-09-02: 서명/도장 존재 여부 플래그
      let hasApostilleKeyword = false; // EP-15: 아포스티유 존재 여부 플래그

      // 전문(Full Text)에서 아포스티유 키워드 1차 검색
      const fullText = document?.text ? document.text.toLowerCase() : "";
      if (fullText.includes("apostille") || fullText.includes("convention de la haye") || fullText.includes("hague convention")) {
        hasApostilleKeyword = true;
      }

      if (document && document.entities && document.entities.length > 0) {
        for (const entity of document.entities) {
          const key = entity.type || "unknown";
          const rawValue = entity.mentionText || "";
          const confidence = entity.confidence || 0;

          // EP-09-03: 민감 개인정보 마스킹 적용
          const maskedValue = maskSensitiveInfo(key, rawValue);
          extractedData[key] = { value: maskedValue, confidence };

          // EP-09-02: 서명(Signature) 또는 도장(Seal) 여부 확인
          const lowerKey = key.toLowerCase();
          if (lowerKey.includes("signature") || lowerKey.includes("seal")) {
            hasSignatureOrSeal = true;
          }

          // 엔티티 키 또는 값에서 아포스티유 키워드 2차 검색
          if (lowerKey.includes("apostille") || rawValue.toLowerCase().includes("apostille") || rawValue.toLowerCase().includes("convention de la haye")) {
            hasApostilleKeyword = true;
          }

          // 신뢰도가 80% 미만이면 결함(Defect)으로 간주
          if (confidence < 0.8) {
            isDefective = true;
            defectReasons.push(`'${key}' 항목의 인식 신뢰도가 낮습니다 (${(confidence * 100).toFixed(1)}%)`);
          }
        }

        // 아포스티유 감지 결과 추가 (EP-15)
        if (hasApostilleKeyword) {
          extractedData["apostille_detected"] = { value: true, confidence: 1.0 };
        }

        // EP-09-02: 서명/도장 누락 시 특정 결함으로 사전 차단
        if (!hasSignatureOrSeal && contentType !== "application/pdf") { // PDF 제외 일부 예외 처리 가능
          isDefective = true;
          defectReasons.push("서명 또는 도장이 누락되었습니다. (EP-09-02)");
        }
      } else {
        isDefective = true;
        defectReasons.push("문서에서 유의미한 텍스트/엔티티를 추출하지 못했습니다.");
      }
    } else {
      console.log(`[DocumentAI] 프로세서 ID가 설정되지 않아 Mock 데이터를 반환합니다.`);
      extractedData = { 
        mock_name: { value: "홍길동", confidence: 0.95 },
        mock_phone: { value: maskSensitiveInfo("phone", "010-1234-5678"), confidence: 0.99 }, // 마스킹 테스트
        apostille_detected: { value: true, confidence: 1.0 } // Mock 데이터 아포스티유 처리
      };
    }

    // 4. 매칭되는 Firestore Document (Evidence) 조회 및 업데이트
    const db = adminInstance.firestore();
    const docQuery = await db.collectionGroup("documents").where("filePath", "==", filePath).limit(1).get();
    
    if (!docQuery.empty) {
      const documentRef = docQuery.docs[0].ref;
      const newStatus = isDefective ? "manual_review_required" : "ai_verified";

      await documentRef.update({
        status: newStatus, // 기존 status를 오버라이드
        aiExtraction: extractedData,
        defectReasons: isDefective ? defectReasons : adminInstance.firestore.FieldValue.delete(),
        aiProcessedAt: adminInstance.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[DocumentAI] 문서 검증 완료: ${documentRef.id} -> ${newStatus}`);

      await logOpsEvent(db, "DOCUMENT_AI_VERIFIED", "SUCCESS", "system_document_ai", "system_trigger", "cases", {
        docId: documentRef.id,
        isDefective,
        defectReasons
      });
    } else {
      console.warn(`[DocumentAI] 매칭되는 Firestore 문서를 찾을 수 없습니다: ${filePath}`);
    }

  } catch (error: any) {
    console.error(`[DocumentAI] 처리 중 오류 발생 (${filePath}):`, error);
    
    // 에러 발생 시 수동 검수 유도를 위해 Audit 로그 기록
    const db = adminInstance.firestore();
    await logOpsEvent(db, "DOCUMENT_AI_FAILED", "FAIL", "system_document_ai", "system_trigger", "cases", {
      filePath,
      error: error.message
    });
  }
};