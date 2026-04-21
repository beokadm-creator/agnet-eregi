# Polling & State Sync

## 1. 개요
사용자(User) 및 파트너(Partner) 화면에서 페이지 새로고침 없이 최신 상태를 실시간으로 확인할 수 있도록, Lightweight Polling API와 프론트엔드 자동 갱신 로직을 구현합니다. 상태 진행 상황(`draft` -> `submitted` -> `processing` -> `completed` 등)을 양측에 일관된 UI 배지로 제공하여 사용자 경험(UX)을 향상시킵니다.

## 2. Polling API 스펙

### 2.1 User Web 전용 (`GET /v1/user/submissions/:id/poll`)
- **목적**: 특정 제출건의 상태, 이벤트 타임라인, 연결된 파트너 케이스/패키지 상태, 진행 중인 추가 서류 요청(`openEvidenceRequests`)을 한 번의 요청으로 묶어서(bundle) 반환합니다.
- **반환 데이터**:
```json
{
  "submission": { "id": "...", "status": "processing", ... },
  "events": [ /* 최근 20개 타임라인 이벤트 */ ],
  "linkedCaseSummary": { "id": "...", "status": "packaging", "updatedAt": "..." },
  "linkedPackageSummary": { "id": "...", "status": "queued", "updatedAt": "..." },
  "openEvidenceRequests": [ /* status: "open" 인 요청 목록 */ ]
}
```

### 2.2 Partner Console 전용 (`GET /v1/partner/cases/:caseId/poll`)
- **목적**: 특정 케이스의 상세 정보, 증거물 목록, 최근 패키지 내역, 진행 중인 추가 서류 요청을 한 번의 요청으로 반환합니다.
- **반환 데이터**:
```json
{
  "case": { "id": "...", "status": "collecting", ... },
  "evidences": [ /* 모든 증거물 목록 */ ],
  "packages": [ /* 최근 5개 패키지 */ ],
  "openEvidenceRequests": [ /* status: "open" 인 요청 목록 */ ],
  "closingReportSummary": { "status": "ready", "artifactPath": "..." }
}
```

## 3. 프론트엔드 폴링 정책

### 3.1 주기 및 부하 관리 (3초 간격)
- 기본 폴링 주기는 **3초(3000ms)** 로 설정합니다.
- 데이터베이스 부하를 최소화하기 위해 API 측에서 쿼리에 `limit`를 적용합니다(events: 20개, packages: 5개).

### 3.2 폴링 중단 조건 (Stop Conditions)
- **Terminal Status**: 
  - User: `completed`, `failed`, `cancelled`
  - Partner: `completed`, `failed`
  - 상태가 종결(Terminal)에 도달하면 불필요한 폴링을 즉시 중단합니다.
- **Visibility API 활용**: 
  - 브라우저 탭이 숨겨지거나 백그라운드로 이동할 경우(`document.visibilityState !== "visible"`), `clearInterval`을 통해 폴링을 멈추어 불필요한 네트워크 및 리소스 낭비를 막습니다.

## 4. UI 및 UX 개선

### 4.1 일관된 상태 문구 (Korean)
시스템 전반에서 일관된 상태 용어를 사용합니다.
- **User Submission**:
  - `draft`: 작성중
  - `submitted`: 제출됨
  - `processing`: 처리중
  - `completed`: 완료
  - `failed`: 실패
  - `cancelled`: 취소됨
  - `cancel_requested`: 취소요청됨
- **Partner Case**:
  - `draft`: 작성중
  - `collecting`: 수집중
  - `packaging`: 패키징중
  - `ready`: 준비됨
  - `failed`: 실패
  - `completed`: 완료됨

### 4.2 폴링 인디케이터
- 케이스 및 제출 상세 화면 상단에 **마지막 갱신 시간**(`lastPolledAt`)을 표시하여 사용자가 현재 보고 있는 정보가 최신 상태인지 인지할 수 있도록 돕습니다.
- 일시적인 네트워크 오류 등으로 폴링에 실패할 경우, ⚠️ **연결 오류**(`pollError`) 배지를 띄우되 화면 레이아웃은 그대로 유지하여 UX 단절을 방지합니다.