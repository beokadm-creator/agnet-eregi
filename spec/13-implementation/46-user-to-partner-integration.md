# User Submission ↔ Partner Case 연동 (End-to-End 통합)

## 1. 개요
사용자가 User Web에서 제출한 `Submission`이 단순한 시뮬레이션으로 끝나지 않고, **실제 Partner Console의 `Case`, `Evidence`, `Package` 생성 워크플로우로 연동**되도록 구성합니다. 
양쪽 시스템이 백그라운드 워커를 통해 서로의 상태를 동기화(Polling & Update)하여 유기적인 서비스 흐름을 제공합니다.

## 2. 연동 아키텍처 및 상태 전이 흐름

| 사용자(User) 액션 및 상태 | 백그라운드 워커 연동 로직 (`userSubmissionWorker`) | 파트너(Partner) 상태 |
| --- | --- | --- |
| `POST /v1/user/submissions` | (Draft 상태로 저장됨) | - |
| `POST /.../submit` (또는 즉시 제출) | `status`가 `submitted`로 변경됨. | - |
| 워커 폴링 (`submitted`) | 1. 파트너 `cases` 생성 (`status: draft`, `submissionId` 연동) <br>2. 파트너 `packages` 생성 요청 (`status: queued`) <br>3. 파트너 `cases` 상태를 `packaging`으로 업데이트 <br>4. 사용자 Submission 상태를 `processing`으로 변경 | `cases` 생성됨 <br>`packages` 큐 대기 |
| 파트너 워커 처리 | (`partnerPackageWorker`가 패키지 빌드 시작) | `packages` 상태 `building` |
| 파트너 워커 완료 | (`partnerPackageWorker`가 빌드 성공/실패 기록) | `packages` 상태 `ready` 또는 `failed` <br> `artifactUrl` 생성 |
| 워커 폴링 (`processing`) | 1. 파트너 `packages` 문서 폴링 <br>2. 패키지가 `ready`면 Submission을 `completed`로 변경 및 `artifactUrl` 복사 <br>3. 패키지가 `failed`면 Submission을 `failed`로 변경 및 에러 복사 | - |

## 3. 모델 변경 사항
- **`user_submissions`**:
  - `partnerId` 필드를 필수로 강제 (없으면 `"default_partner"` 배정).
  - `caseId` 및 `packageId` 필드 추가 (파트너 쪽 리소스 추적용).
- **`cases` (Partner)**:
  - `submissionId` 필드 추가 (원본 사용자 제출 내역 추적용).

## 4. 증거물 연동 (옵션 API)
- `POST /v1/user/submissions/:id/link-evidence`
- 사용자가 별도로 업로드한 파일(URL)들을 배열로 넘기면, 해당 Submission에 연결된 파트너 Case의 `evidences` 컬렉션에 복사하여 등록합니다. 이를 통해 파트너가 패키지를 생성할 때 사용자의 증거물을 활용할 수 있습니다.

## 5. UI 동기화
- **User Web**:
  - Submission 상세 조회 시 `caseId`와 `packageId`가 존재하면 링크/배지로 표시.
  - 패키징이 완료되면 `✅ 처리 결과`와 함께 파트너가 생성한 `artifactUrl` 다운로드 링크 노출.
- **Partner Console**:
  - Case 상세 조회 시 연동된 `submissionId`가 있으면 "🔗 원본 User Submission 연동됨" 표시.

## 6. 에러 및 취소 처리
- 사용자가 `processing` 상태일 때 취소(`cancel_requested`)를 요청하더라도, 파트너 쪽으로 이미 큐가 넘어간 상태라면 롤백이 복잡하므로 현재 로직에서는 취소 요청 시 상태만 `cancelled`로 끊고 파트너 작업은 계속 진행되도록 둡니다. (또는 파트너 패키지 상태 폴링 시 캔슬 처리를 무시함)
- 파트너 빌드가 실패(`failed`)하면, 사용자 UI에도 동일한 에러 메시지와 함께 `failed` 상태로 동기화됩니다. 파트너가 재생성(`regenerate`)을 누르면 다시 `queued`가 되나, 사용자 워커는 한 번 `failed`로 끝난 Submission을 다시 폴링하지는 않습니다. (재시도는 사용자 측에서 새로 Submission을 만드는 것이 권장됨)
