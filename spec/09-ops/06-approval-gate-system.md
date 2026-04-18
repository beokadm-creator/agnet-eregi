# 승인 게이트(Approval Gate) 시스템 스펙 — v1

목표: “AI/파트너/운영이 확정 행위를 하려는 순간”에 사고를 막기 위해, 모든 고위험 액션을 **승인 요청(Approval Request)** 으로 분리하고, 승인/반려/수정 과정을 **이벤트/감사로그**로 증빙한다.

참조:
- 승인 이벤트: `02-engine/events/case_event.schema.json` (`APPROVAL_REQUESTED/APPROVED/REJECTED`)
- API 규약(412): `02-engine/06-api-error-and-idempotency.md`
- Ops 콘솔 요구사항: `09-ops/01-ops-console-requirements.md`
- 보안/RBAC: `10-security/01-auth-rbac-rls.md`

---

## 1) 승인 게이트가 필요한 이유(정의)

승인 게이트는 아래를 구조적으로 보장합니다.
- AI가 외부 메시지를 “바로 발송”하지 못한다
- 파트너가 견적을 “바로 확정”하지 못한다(정책/동의/대사)
- 환불/정산/PII 열람 등은 반드시 사유/승인/기록이 남는다

---

## 2) 승인 게이트 목록(표준 enum)

이벤트 스키마 기준(확장 가능):
- `message_send`
- `quote_finalize`
- `refund_approve`
- `case_reassign`
- `pii_view`
- `partner_onboarding_approve`
- `partner_grade_change`
- `partner_suspend`

---

## 3) 승인 요청(Approval Request) 상태 머신

상태:
- `pending` : 승인 대기
- `approved` : 승인 완료
- `rejected` : 반려
- `cancelled` : 취소(요청자가 철회)
- `expired` : 만료(예: 24시간)

전이:
- 생성 → pending
- pending → approved/rejected/cancelled/expired

---

## 4) 승인 패킷(Approval Pack) — 승인자가 봐야 하는 것

승인 요청은 “그냥 버튼”이 아니라, 승인 판단을 위한 패킷입니다.

필수 필드(요지):
- `approvalRequestId`
- `approvalGate`
- `targetType` / `targetRef` (case/quote/refund/message/partner 등)
- `summaryKo`
- `payloadHash` (승인 대상 payload의 무결성)
- `diff` (변경 전/후, 가능하면)
- `sourceRefs` (정책/사건팩/이벤트/문서 근거)
- `riskLevel` (low/medium/high)
- `requiredRole` (ops_agent/ops_approver 등)

> diff는 완전한 diff가 어려우면 “핵심 필드 5개”만 비교하는 형태로 시작.

---

## 5) API 동작(패턴)

### 5.1 “확정 엔드포인트”의 공통 패턴
예: `POST /v1/cases/{caseId}/quote/finalize`

1) 서버는 RBAC 체크
2) 정책 엔진으로 사전 검증
3) 승인 게이트 필요 시:
   - `APPROVAL_REQUESTED` 이벤트 발행
   - DB에 approval_request 저장
   - HTTP 412 `APPROVAL_REQUIRED` 반환(details에 approvalRequestId)
4) 승인 완료 후 재호출(또는 승인 시스템이 최종 실행):
   - `APPROVAL_APPROVED` 이벤트 발행
   - 실제 확정 처리 수행(이벤트/스냅샷 반영)

### 5.2 승인 처리 엔드포인트(운영)
- `GET /v1/ops/approvals?status=pending&gate=...`
- `POST /v1/ops/approvals/{approvalRequestId}/decision` (approve/reject)

응답:
- 승인 결과 + (선택) 후속 액션 실행 결과

---

## 6) DB 스키마(권장)

DB 상세는 `08-data/01-db-model.md`에 반영.

핵심 테이블:
- `approval_requests`
- `approval_decisions`

---

## 7) 감사/재현 요구사항(필수)

승인 시스템은 반드시 아래를 남김:
- `domain_events`: `APPROVAL_*`
- `audit_logs`: 누가 승인/반려했는지 + 사유 + 대상
- payload hash + (가능하면) payload snapshot

---

## 8) AI 위임 규칙

AI 가능:
- 승인 패킷 생성(요약/근거 수집/diff 생성)
- 승인 큐 우선순위 추천

AI 금지:
- `approved` 결정 확정(L1 이상)
- PII 열람 승인 확정

