# User Submission, Status & Result (사용자 웹 제출/결과 플로우)

## 1. 개요
최종 사용자가 AgentRegi 시스템을 통해 자신의 데이터(예: 비자 신청, 학교 등록 정보 등)를 입력하고 제출하는 워크플로우입니다.
사용자는 제출한 건의 진행 상태를 실시간으로 조회하고, 파트너 연동 등을 거친 최종 결과물(PDF 파일 등)을 받아볼 수 있습니다.

## 2. 데이터 모델

### 2.1 UserSubmission (`user_submissions`)
- **역할**: 사용자 한 명의 제출(신청) 건을 담는 최상위 컨테이너.
- **주요 필드**:
  - `userId`: 소유자 UID.
  - `status`: 제출 건의 현재 상태.
  - `input`: 사용자가 입력한 초기 페이로드(`type`, `payload`).
  - `result`: 처리가 끝난 후의 결과물 요약 및 다운로드 링크(`artifactUrl`). 에러 시 에러 내역 포함.
  - `caseId`: 처리가 성공하면 파트너 측에 자동으로 생성/연결된 파트너 콘솔의 케이스 ID.

### 2.2 SubmissionEvent (`submission_events`)
- **역할**: 사용자에게 진행 상황을 투명하게 노출하기 위한 타임라인 이벤트.
- **주요 필드**:
  - `submissionId`: 연결된 제출 건.
  - `type`: `submitted`, `processing_started`, `processing_progress`, `completed`, `failed`, `cancelled`
  - `message`: 사용자에게 노출될 안내 문구 (예: "데이터 분석 중...", "정상적으로 심사가 접수되었습니다.")

## 3. 서버 API (사용자 스코프 강제)
모든 API는 요청자의 토큰 내 `uid`(`userId`)를 검증하여, **본인이 작성한 제출 건에만 접근**할 수 있도록 보호됩니다.

- `POST /v1/user/submissions`: 새 제출 생성 (즉시 제출 옵션 포함)
- `POST /v1/user/submissions/:id/submit`: `draft` 상태의 제출 건을 실제 제출(`submitted`)
- `POST /v1/user/submissions/:id/cancel`: 제출 취소. `processing` 중이면 `cancel_requested`로 변경.
- `GET /v1/user/submissions`: 내 제출 목록 조회
- `GET /v1/user/submissions/:id`: 제출 상세 정보 조회
- `GET /v1/user/submissions/:id/events`: 진행 상황(타임라인) 조회

## 4. 백그라운드 워커 (User Submission Worker)
- **Worker**: `userSubmissionWorker` (매 1분마다 실행)
- **로직**:
  1. `status == "submitted"`인 제출 건을 가져와 `processing` 상태로 변경 및 `processing_started` 이벤트 기록.
  2. (시뮬레이션) 2초 대기 후 `processing_progress` 이벤트 기록.
  3. 대기 중 사용자가 취소(`cancel_requested`)를 누른 경우, `cancelled` 상태로 즉시 종료.
  4. (시뮬레이션) 10% 확률로 데이터 에러(`failed` 상태) 발생.
  5. 성공 시 `completed` 상태로 전환하며, 가짜 결과물 URL과 **파트너 `caseId`**를 부여하여 결과 반환.

## 5. User Web UI 가이드
- **인증**: Firebase Auth Token(`uid` 포함)을 입력하여 로그인 흉내.
- **좌측 패널**: 내 제출 목록 표시. 새 제출을 생성할 때 Payload(JSON)와 즉시 제출 옵션을 선택할 수 있음.
- **우측 패널**:
  - 입력한 Payload 데이터 확인.
  - 제출 전이면 `[제출하기(Submit)]`, 진행 전이면 `[제출 취소]` 버튼 제공.
  - 하단 타임라인을 통해 워커가 남긴 이벤트를 순차적으로 확인.
  - 처리가 완료되면 `✅ 처리 결과`와 함께 결과 문서 다운로드 링크가 나타남.
