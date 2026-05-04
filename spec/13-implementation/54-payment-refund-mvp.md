# 54. Payment and Refund MVP

## 개요
사용자 웹에서 초기 결제를 진행하고, 파트너 콘솔에서 환불 요청을 하며, Ops 콘솔에서 이를 승인 및 실행하는 Payment/Refund MVP 구현.

## 상태 전이표 (State Transition)

### Payment 상태 전이
| 현재 상태 | 액션 | 다음 상태 | 트리거 주체 | 설명 |
|---|---|---|---|---|
| `(없음)` | `POST /v1/user/payments` | `initiated` | User | 결제 초기화 |
| `initiated` | `POST /v1/user/payments/:paymentId/confirm` | `captured` | User | 결제 확인 및 승인 |

### Refund 상태 전이
| 현재 상태 | 액션 | 다음 상태 | 트리거 주체 | 설명 |
|---|---|---|---|---|
| `(없음)` | `POST /v1/partner/cases/:caseId/refunds` | `requested` | Partner | 파트너가 환불 요청 |
| `requested` | `POST /v1/ops/cases/:caseId/refunds/:refundId/approve` | `approved` | Ops (operator+) | 환불 요청 승인 |
| `approved` | `POST /v1/ops/cases/:caseId/refunds/:refundId/execute` | `executed` | Ops (admin) | 실제 환불 실행 |

## RBAC (Role-Based Access Control)

| 엔드포인트 | 역할 (Role) | 설명 |
|---|---|---|
| `POST /v1/user/payments` | `User` | 인증된 일반 사용자 |
| `POST /v1/user/payments/:paymentId/confirm` | `User` | 결제 주체 본인 |
| `POST /v1/partner/cases/:caseId/refunds` | `Partner` | 인증된 파트너 (해당 case의 파트너) |
| `POST /v1/ops/cases/:caseId/refunds/:refundId/approve` | `ops_operator` (이상) | Ops Operator 권한 필요 |
| `POST /v1/ops/cases/:caseId/refunds/:refundId/execute` | `ops_admin` | Ops Admin 권한 필요 |
| `GET /v1/ops/cases/:caseId/refunds` | `ops_viewer` (이상) | 환불 목록 조회 권한 |

## 에러 코드 (Error Codes)

| HTTP 상태 코드 | 에러 코드 | 설명 |
|---|---|---|
| 400 | `INVALID_ARGUMENT` | 필수 파라미터(amount, currency, reason 등) 누락 |
| 400 | `FAILED_PRECONDITION` | 이전 상태가 맞지 않음 (예: `initiated`가 아닌데 confirm 시도) |
| 403 | `FORBIDDEN` | RBAC 권한 부족 (예: `ops_operator`가 execute 시도) |
| 404 | `NOT_FOUND` | 해당하는 결제, 케이스 또는 환불 요청을 찾을 수 없음 |
| 500 | `INTERNAL` | 서버 내부 오류 또는 Firestore 통신 오류 |

## Audit Events (감사 로그)

아래의 이벤트가 발생할 때마다 `audit_events` 컬렉션에 기록됨.

- `payment.created`
- `payment.captured`
- `refund.requested`
- `refund.approved`
- `refund.executed`
