import { ImageAnnotatorClient } from "@google-cloud/vision";
import { checkAndRecordUsage } from "./quota";

let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    visionClient = new ImageAnnotatorClient();
  }
  return visionClient;
}

/**
 * Google Cloud Storage에 있는 이미지 파일의 텍스트를 추출 (OCR)
 * @param partnerId The partner ID for quota tracking.
 * @param gsUri gs://bucket_name/path/to/image.jpg
 * @returns 추출된 전체 텍스트
 */
export async function extractTextFromImage(partnerId: string, gsUri: string): Promise<string> {
  const quotaLimit = 500; // Example quota limit for OCR
  const isAllowed = await checkAndRecordUsage(partnerId, "ocr", quotaLimit);

  if (!isAllowed) {
    console.error(`[Vision API] Quota exceeded for partner ${partnerId}`);
    throw new Error("OCR 추출 할당량을 초과했습니다.");
  }

  try {
    const client = getVisionClient();
    const [result] = await client.textDetection(gsUri);
    
    const annotations = result.textAnnotations;
    if (annotations && annotations.length > 0) {
      return annotations[0].description || "";
    }
    return "";
  } catch (error) {
    console.error("[Vision API] Text extraction failed:", error);
    throw new Error("OCR 추출에 실패했습니다.");
  }
}

/**
 * 추출된 텍스트를 기반으로 문서 유형별 필수 항목이 포함되어 있는지 검증
 * @param extractedText OCR로 추출된 텍스트
 * @param documentType 증빙 서류 유형 (예: BUSINESS_LICENSE, ID_CARD)
 * @returns { isValid: boolean, missingKeywords: string[] }
 */
export function validateDocument(extractedText: string, documentType: string): { isValid: boolean, missingKeywords: string[] } {
  if (!extractedText) {
    return { isValid: false, missingKeywords: ["텍스트를 찾을 수 없습니다."] };
  }

  const text = extractedText.replace(/\s+/g, "").toLowerCase();
  let requiredKeywords: string[] = [];

  switch (documentType) {
    case "BUSINESS_LICENSE":
      // 사업자등록증 필수 키워드 (띄어쓰기 무시)
      requiredKeywords = ["사업자등록증", "등록번호", "상호", "대표자", "개업연월일"];
      break;
    
    case "ID_CARD":
      // 주민등록증 또는 운전면허증 키워드 (둘 중 하나라도 만족하면 됨)
      const isResidentCard = text.includes("주민등록증") && text.includes("발급일자");
      const isDriverLicense = text.includes("자동차운전면허증") && text.includes("적성검사");
      
      if (isResidentCard || isDriverLicense) {
        return { isValid: true, missingKeywords: [] };
      }
      return { isValid: false, missingKeywords: ["주민등록증/운전면허증 필수 항목"] };

    case "CORPORATE_SEAL_CERT":
      requiredKeywords = ["법인인감증명서", "상호", "대표이사", "인감"];
      break;

    case "CORPORATE_REGISTER":
      requiredKeywords = ["법인등기사항전부증명서", "등기번호", "본점", "공고사항"];
      break;

    default:
      // 정의되지 않은 문서 타입은 기본적으로 수동 검토 대상(Valid로 간주하거나 False로 간주할 수 있으나 여기서는 통과로 간주)
      return { isValid: true, missingKeywords: [] };
  }

  const missingKeywords = requiredKeywords.filter(keyword => !text.includes(keyword.toLowerCase()));
  
  return {
    isValid: missingKeywords.length === 0,
    missingKeywords
  };
}
