# 신규 사건 카테고리(사건팩) 확장 구조 설계

## 1. 개요 (Overview)
본 문서는 플랫폼 내 신규 사건(Case) 유형을 유연하게 추가하고 관리하기 위한 '사건팩(Case Pack)' 확장 구조의 설계 및 구현 방안을 정의합니다. 하드코딩된 사건 유형에서 벗어나, 데이터 기반의 동적 렌더링 및 워크플로우를 지원하여 비즈니스 확장성을 극대화합니다.

## 2. 핵심 아키텍처 (Core Architecture)

### 2.1 사건팩 (Case Pack) 정의
사건팩은 특정 사건 카테고리(예: 임원 변경, 부동산 소유권 이전 등)를 처리하기 위해 필요한 메타데이터, 입력 폼(Form Schema), 필요 증거자료(Evidence Requirements), 워크플로우(Workflow)를 하나로 묶은 설정 단위입니다.

### 2.2 동적 스키마 기반 구조 (Schema-driven Design)
- **UI/UX 렌더링**: 사건팩의 JSON Schema를 기반으로 사용자 입력 폼(User Funnel, `59-user-funnel-and-matching.md` 연계)을 동적으로 생성합니다.
- **증거 자료 매핑**: `44-partner-case-evidence-package.md`와 연계하여 사건별 필수/선택 증거 목록(Evidence Requirements)을 동적으로 할당합니다.
- **워크플로우 제어**: 사건마다 상태 전이 단계(Stage)와 체크리스트가 다르므로 이를 사건팩 메타데이터로 분리하여 관리합니다.

---

## 3. 데이터 모델 설계 (Firestore 스키마)

### 3.1 `case_packs` (신규 마스터 컬렉션)
신규 카테고리의 속성과 워크플로우 규칙을 정의하는 설정(Config) 문서입니다.

```typescript
interface CasePack {
  id: string;                  // 사건팩 고유 ID (ex: "real_estate_transfer_v1")
  category: string;            // 대분류 (ex: "real_estate")
  nameKo: string;              // 사건명 (ex: "부동산 소유권 이전 등기")
  active: boolean;             // 활성화 여부
  
  // 동적 UI 렌더링 및 데이터 검증을 위한 JSON Schema
  formSchema: {
    type: "object",
    properties: Record<string, any>
  };
  
  // 워크플로우 및 서류 설정
  workflow: {
    stages: string[];          // 예: ["docs_collect", "docs_review", "draft_filing", "completed"]
    requiredSlots: string[];   // 예: ["slot_id_card", "slot_real_estate_registry", "slot_contract_signed"]
    checklists: Record<string, ChecklistItem[]> // 단계별 체크리스트
  };
  
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ChecklistItem {
  itemId: string;
  titleKo: string;
}
```

### 3.2 `cases` (기존 컬렉션 확장)
`casePackId`를 기준으로 생성되며, 입력 데이터는 유연한 `dynamicData` 필드에 저장됩니다.

```typescript
interface Case {
  id: string;
  casePackId: string;          // 사건팩 ID 참조 (필수)
  status: string;
  userId: string;
  partnerId: string;
  
  // 사건팩 스키마에 맞춰 수집된 폼 데이터 (JSON)
  dynamicData: Record<string, any>; 
  
  // 타임라인, 워크플로우 상태 등은 기존 공통 구조 유지
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## 4. API 명세 (HTTP API Contract)

### 4.1 사건팩 메타데이터 조회
- **`GET /v1/case-packs`**
  - **역할**: 사용자 퍼널(홈 화면)에서 선택 가능한 카테고리 목록을 노출하기 위해 활성화된 사건팩 목록을 반환합니다.
- **`GET /v1/case-packs/:casePackId`**
  - **역할**: 특정 사건팩의 상세 스키마(`formSchema`), 필요 서류 목록, 안내 문구를 반환하여 클라이언트가 동적으로 UI 폼을 렌더링하도록 돕습니다.

### 4.2 케이스 생성 및 폼 데이터 제출 (확장)
- **`POST /v1/cases`**
  - **Request**: `{ "sessionId": "...", "selectedPartnerId": "...", "casePackId": "real_estate_transfer_v1" }`
  - **역할**: `casePackId`를 주입받아 초기 케이스 워크스페이스를 생성합니다.
- **`POST /v1/cases/:caseId}/forms/dynamic`**
  - **Request**: `{ "dynamicData": { "propertyAddress": "서울특별시...", "transactionAmount": 500000000 } }`
  - **역할**: 기존 하드코딩된 엔드포인트 대신, 범용 엔드포인트를 두어 `case_packs`의 `formSchema`에 맞춰 데이터를 검증(Validation)하고 저장합니다.

### 4.3 워크플로우 및 서류 조회 (기존 API 호환)
- **`GET /v1/cases/:caseId}/workflow`**
  - **역할**: `casePack` 설정(요구 슬롯, 체크리스트)과 현재 `case`의 상태를 병합하여 반환합니다. 클라이언트는 이 응답만 보고도 어떤 서류를 더 업로드해야 하는지(Next Action) 알 수 있습니다.

---

## 5. 설계 방향 및 원칙 (Design Direction)

1. **워크플로우 엔진의 추상화 (Workflow Interpreter)**
   - 백엔드 로직이 개별 사건의 비즈니스 규칙을 직접 알지 못하도록 분리합니다. 특정 단계로 전진을 요청할 때, 서버는 DB에 정의된 `requiredSlots`가 모두 `ok` 상태인지 동적으로 확인하고 승인하는 상태 머신(State Machine) 역할만 수행합니다.
2. **UI의 Server-Driven Rendering (SDR) 도입**
   - 사건팩이 추가될 때마다 프론트엔드(React) 코드를 수정하는 것은 비효율적입니다. `formSchema` 필드에 JSON Schema 기반의 UI 구성을 정의하고, 프론트엔드는 이를 바탕으로 동적 폼(Dynamic Form)을 렌더링해야 합니다.
3. **문서 템플릿 플러그인 팩토리 패턴**
   - 기존 문서 생성 로직을 팩토리 패턴(Factory Pattern)으로 리팩토링하여, `casePackId`에 따라 각기 다른 템플릿 제너레이터(Docx 빌더) 플러그인이 주입되어 실행되도록 설계합니다.
4. **단계적 도입 (Phase 1~3 호환성)**
   - 현재 MVP 단계에서는 임원 변경 등기 로직을 일부 하드코딩하더라도, 데이터베이스 및 API의 외곽 인터페이스에는 반드시 `casePackId`를 파라미터로 유지해야 합니다. 이를 통해 추후 데이터 마이그레이션 없이 새로운 사건팩을 추가하는 것만으로 자연스러운 확장이 가능해집니다.
