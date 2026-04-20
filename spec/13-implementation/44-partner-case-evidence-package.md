# Partner Case, Evidence & Package (엔드투엔드 파트너 플로우)

## 1. 개요
AgentRegi의 파트너(가맹점/제휴사)가 실제로 이용하는 핵심 비즈니스 워크플로우입니다.
파트너는 **케이스(Case)**를 생성하고, 필요한 **증거(Evidence)** 문서들을 업로드한 뒤, 이를 하나의 **패키지(Package)**로 묶어 제출(Build)합니다.

## 2. 데이터 모델 및 상태(Status) 전이

### 2.1 Case (`cases`)
- **역할**: 단일 심사/제출 건의 최상위 컨테이너.
- **상태 전이**:
  - `draft`: 케이스가 막 생성된 상태.
  - `collecting`: 증거(Evidence)가 하나라도 추가된 상태.
  - `packaging`: 패키지(Package) 생성 요청이 들어간 상태.
  - `ready`: 패키지 생성이 완료된 상태.
  - `failed`: 패키지 생성 중 에러가 발생한 상태.

### 2.2 Evidence (`evidences`)
- **역할**: 케이스에 귀속되는 개별 증거 파일 메타데이터.
- **상태**:
  - `uploaded`: 파일 URL이 등록됨. (현재 MVP 기본 상태)
  - `validated`: (추후) 바이러스 스캔이나 파일 무결성 검증 통과.
  - `failed`: (추후) 검증 실패.

### 2.3 Package (`packages`)
- **역할**: 특정 시점의 증거물들을 묶어서 빌드(Zip 압축 또는 PDF 병합)한 산출물.
- **상태 전이**:
  - `queued`: 생성이 요청되어 대기열에 들어간 상태.
  - `building`: 워커가 실제로 파일을 묶고 있는 상태.
  - `ready`: 생성이 완료되어 `artifactUrl`이 생성된 상태.
  - `failed`: 생성 중 에러 발생. (재시도 가능)

## 3. 서버 API (파트너 스코프 강제)
모든 API는 요청자의 토큰 내 `partnerId`를 검증하여, **자신이 소유한 케이스/증거/패키지에만 접근**할 수 있도록 철저히 격리(Scoped)됩니다.

- `POST /v1/partner/cases`: 케이스 생성
- `GET /v1/partner/cases`: 내 케이스 목록
- `GET /v1/partner/cases/:caseId`: 케이스 상세
- `POST /v1/partner/cases/:caseId/evidences`: 증거 파일(URL) 추가
- `GET /v1/partner/cases/:caseId/evidences`: 증거 목록
- `POST /v1/partner/cases/:caseId/packages`: 패키지 생성(빌드) 트리거
- `GET /v1/partner/cases/:caseId/packages`: 패키지 목록
- `POST /v1/partner/cases/:caseId/packages/:packageId/regenerate`: 실패한 패키지 재시도

## 4. 백그라운드 워커 (Package Builder)
- **Worker**: `partnerPackageWorker` (매 1분마다 실행)
- **로직**:
  - `status == "queued"`인 패키지를 찾아 `building`으로 상태 변경.
  - (시뮬레이션) 3초 대기 후 가상의 Storage URL을 `artifactUrl`로 저장하고 `ready` 처리.
  - 10% 확률로 임의 에러(네트워크 오류 등)를 발생시켜 `failed` 상태 전이 테스트 가능.
  - 패키지 상태 변경 시, 부모 `Case`의 상태도 함께(`packaging` -> `ready` or `failed`) 업데이트(Batch).

## 5. Partner Console UI 가이드
- **인증**: Firebase Auth Custom Token(클레임에 `partnerId` 포함)을 입력하여 로그인 흉내.
- **좌측 패널**: 내 케이스 목록 표시. 선택 시 우측에 상세 렌더링.
- **우측 패널**:
  - 증거물(유형, URL)을 추가.
  - 증거물이 1개 이상일 때 `[패키지 생성 요청]` 버튼 활성화.
  - 생성된 패키지 목록에서 상태(Queued, Building, Ready, Failed) 실시간 확인 가능 (수동 새로고침).
  - Ready 상태면 `[⬇️ 패키지 다운로드]` 링크 표시.
  - Failed 상태면 에러 사유 표시 및 `[재시도]` 버튼 활성화.