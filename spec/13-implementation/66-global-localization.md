# 66. Global & Localization (EP-15)

## 1. 개요 (Overview)
본 문서는 AgentRegi 플랫폼을 글로벌 시장 및 다국적 사용자를 위해 확장하는 **EP-15 Global & Localization (글로벌 및 다국어 지원)**의 구현 세부 사항을 정의합니다.
한국어에 익숙하지 않은 외국인 고객(Expat), 해외 법인의 국내 진출, 또는 다국가 파트너와의 협업을 원활하게 지원하기 위해 다국어 UI, 타임존 동기화, 다중 통화(Multi-currency) 결제, 그리고 국가별 규제 요건을 시스템에 통합하는 것이 핵심 목표입니다.

## 2. 주요 Use Case (Target Scenarios)
- **외국인/해외법인 고객 지원**: 영어, 일본어, 중국어 등 다국어 UI를 제공하여, 외국인 창업자나 해외 기업이 언어 장벽 없이 한국 내 법인 설립 및 등기 업무를 진행.
- **다국가 파트너 협업**: 글로벌 파트너(해외 로펌, 회계법인 등)와 크로스보더(Cross-border) 케이스 협업 시, 각자의 선호 언어 및 타임존 환경에서 워크스페이스를 이용.
- **다중 통화 결제 및 정산**: USD, EUR, JPY 등 현지 통화로 견적을 확인하고 글로벌 결제 게이트웨이(Stripe 등)를 통해 결제하며, 파트너에게는 플랫폼에 설정된 통화로 정산.
- **아포스티유(Apostille) 검증**: 해외에서 발급된 공문서의 효력을 인정받기 위한 아포스티유 확인 파이프라인 연동.

## 3. 다국어 및 지역화 아키텍처 (Localization Architecture)
- **i18n (국제화) 프레임워크**: 프론트엔드는 `react-i18next`를 적용하여 동적 언어 전환을 지원하고, 번역 리소스는 JSON 형태의 언어 팩으로 관리합니다.
- **콘텐츠 번역 파이프라인**: Phrase, Lokalise 등 번역 관리 시스템(TMS) 연동. 개발자가 번역 키를 추가하면 AI 기반 1차 번역 및 전문 번역가의 감수를 거쳐 CI/CD 파이프라인을 통해 배포.
- **타임존(Timezone) 및 날짜 포맷**: DB (Firestore)에는 모든 일시를 `UTC` 기준으로 저장하고, 프론트엔드에서 사용자의 로컬 타임존(또는 명시적 설정값)에 맞춰 `date-fns-tz` 등으로 변환하여 표시.
- **통화(Currency) 및 환율 관리**: 금액 계산 시 외부 환율 API를 주기적으로 폴링하여 기준 환율을 캐싱하며, 결제 시점의 환율을 적용해 청구 금액을 산정합니다.

## 4. 데이터 모델 (Firestore)

### 4.1 Collection: `user_preferences` (사용자/파트너 설정)
사용자 및 파트너의 지역화 설정을 관리합니다. (기존 `users` 컬렉션의 하위 문서 또는 병합 형태로 관리)

```typescript
interface UserPreferences {
  locale: "ko-KR" | "en-US" | "ja-JP" | "zh-CN"; // UI 언어
  timezone: string;       // 예: "Asia/Seoul", "America/New_York"
  currency: "KRW" | "USD" | "JPY";               // 선호 표시 통화
  updatedAt: Timestamp;
}
```

### 4.2 Collection: `case_translations` (케이스 다국어 지원)
파트너의 보완 요청 메시지나 견적 코멘트 등 자유 텍스트의 자동 번역본을 캐싱하여 API 호출 비용을 절감합니다.

```typescript
interface CaseTranslation {
  id: string;             // translationId
  caseId: string;
  sourceText: string;
  sourceLang: string;     // 예: "ko"
  targetLang: string;     // 예: "en"
  translatedText: string;
  provider: "google" | "deepl"; // 번역 엔진
  createdAt: Timestamp;
}
```

### 4.3 확장된 `payments` 스키마
다중 통화 결제를 지원하기 위해 기존 결제 모델을 확장합니다.

```typescript
interface Payment {
  id: string;
  caseId: string;
  userId: string;
  amount: number;
  currency: string;             // "KRW", "USD" 등
  exchangeRate?: number;        // 결제 시점 환율
  krwEquivalentAmount?: number; // 원화 환산 금액
  provider: "tosspayments" | "stripe";
  status: "pending" | "completed" | "failed";
  createdAt: Timestamp;
}
```

## 5. 핵심 API 명세 (HTTP API Contract)

### 5.1 다국어 템플릿 및 메타데이터 조회
- **GET** `/v1/meta/locales/{locale}/templates`
  - **역할**: 지정된 언어(`locale`)에 맞는 문서 템플릿, 카테고리 명칭, 에러 메시지 맵을 반환합니다.

### 5.2 실시간 메시지/코멘트 번역
- **POST** `/v1/cases/{caseId}/translate`
  - **역할**: 파트너가 한국어로 작성한 코멘트를 사용자의 설정 언어로 자동 번역하여 반환 및 저장합니다. (DeepL API 또는 Google Cloud Translation 연동)
  - **Payload**: `{ "text": "주주명부를 스캔해서 업로드해주세요.", "targetLang": "en" }`
  - **Response**: `{ "translatedText": "Please scan and upload the shareholder register." }`

### 5.3 환율 기반 견적 변환 (Quote Currency Conversion)
- **GET** `/v1/cases/{caseId}/quote?currency=USD`
  - **역할**: 원화(KRW) 기준으로 작성된 견적서를 최신 환율을 적용하여 요청한 통화(USD)로 변환하여 제공합니다.

## 6. 아포스티유 및 해외 서류 검증 (Apostille Verification Pipelines)
- **증거 자료 슬롯 동적 할당**: 사건팩(`case_packs`) 구조를 활용해, 해외 참여자가 포함된 케이스 워크플로우에 '아포스티유 인증본' 요구 슬롯을 자동으로 추가합니다.
- **자동화 판독 (1차)**: Document AI(OCR)를 통해 업로드된 문서가 아포스티유 표준 서식을 준수하고 발행 국가 및 일련번호가 명시되어 있는지 판독합니다.
- **매뉴얼 리뷰 (2차)**: 전자 아포스티유(e-Apostille) 발급 국가의 경우, 오퍼레이터가 정부 포털에서 일련번호를 직접 조회하여 진위 여부를 최종 확정합니다.
- **상태 전이 관리**: 케이스 및 서류 슬롯 상태에 `pending_apostille_verification` 및 `apostille_rejected` 상태를 도입합니다.

## 7. 운영 및 법무 컴플라이언스 (Compliance & Ops)
- **국가별 데이터 보호법 준수**: 유럽 GDPR, 캘리포니아 CCPA 등 사용자의 접속 국가에 맞춘 쿠키 동의(Cookie Consent) 및 데이터 보존/삭제(Right to be forgotten) 정책 자동 적용.
- **KYC/AML (글로벌 신원인증)**: 해외 사용자의 경우 여권, 해외 신분증을 통한 신원 인증(KYC) 및 자금세탁방지(AML) 스크리닝을 위해 글로벌 인증 솔루션(예: Onfido, Sumsub) 연동을 추가합니다.