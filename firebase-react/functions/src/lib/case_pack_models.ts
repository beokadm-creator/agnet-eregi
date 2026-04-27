import * as admin from "firebase-admin";

export interface ChecklistItem {
  itemId: string;
  titleKo: string;
}

export interface CasePack {
  id: string;                  // 사건팩 고유 ID (ex: "real_estate_transfer_v1")
  category: string;            // 대분류 (ex: "real_estate")
  nameKo: string;              // 사건명 (ex: "부동산 소유권 이전 등기")
  active: boolean;             // 활성화 여부
  
  // 동적 UI 렌더링 및 데이터 검증을 위한 JSON Schema
  formSchema: {
    type: "object";
    properties: Record<string, any>;
  };
  
  // 워크플로우 및 서류 설정
  workflow: {
    stages: string[];          // 예: ["docs_collect", "docs_review", "draft_filing", "completed"]
    requiredSlots: string[];   // 예: ["slot_id_card", "slot_real_estate_registry", "slot_contract_signed"]
    checklists: Record<string, ChecklistItem[]>; // 단계별 체크리스트
  };
  
  createdAt: admin.firestore.Timestamp;
  updatedAt: admin.firestore.Timestamp;
}
