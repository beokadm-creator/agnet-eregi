# 상태 머신(State Machines) — v1

목표: 개발/QA/운영이 같은 언어로 “현재 상태”를 판단할 수 있게, 케이스·문서·견적·결제·환불·정산의 **상태/전이/트리거/권한/이벤트**를 고정한다.

---

## 1) 케이스 상태(`cases.status`)

### 1.1 상태 정의
- `new` : 케이스 생성 직후(파트너 연결 완료, 작업 착수 전)
- `in_progress` : 진행 중(파트너가 처리 중)
- `waiting_user` : 사용자 액션 대기(보완서류/동의/결제 등)
- `waiting_partner` : 파트너 액션 대기(견적확정/검토결과 등)
- `manual_review` : 운영 수동검토 큐
- `completed` : 완료(제출/등기 완료 등 사건팩 정의 완료 기준)
- `cancelled` : 취소(환불/정산 상태에 따라 후속 처리)

> 사건팩에 따라 세분 상태가 필요하면 `cases.sub_status`(text) 또는 `case_timeline`/`domain_events`로 확장한다.

### 1.2 전이 표(요약)

| from | to | 트리거 | 권한 | 필수 이벤트 |
|---|---|---|---|---|
| (없음) | new | `POST /v1/cases` | user/system | `CASE_CREATED` |
| new | waiting_user | 문서 슬롯 생성/요청 | system/partner | (선택) `DOCUMENT_REVIEW_REQUESTED` |
| waiting_user | waiting_partner | 사용자 업로드/응답 | user | `DOCUMENT_UPLOADED` 또는 `FIX_SUBMITTED` |
| waiting_partner | in_progress | 파트너 수락/착수 | partner | `CASE_ACCEPTED` |
| in_progress | waiting_user | 보완 요청 발송(승인) | partner/ops | `FIX_REQUEST_SENT` |
| in_progress | manual_review | 리스크 플래그/정책 위반 | system/ops | `RISK_FLAGGED`, `CASE_ESCALATED_TO_OPS` |
| manual_review | in_progress | 운영 승인 후 재개 | ops | `CASE_ESCALATED_TO_OPS`(reason 업데이트) |
| in_progress | completed | 완료 처리 | partner/ops | `CASE_COMPLETED` |
| * | cancelled | 취소 처리 | user/ops | `CASE_CANCELLED` |

---

## 2) 문서 슬롯 상태(`documents.status` / `DocSlotCard.status`)

### 2.1 상태 정의(이미 UI 계약에 존재)
- `미업로드`
- `검토중`
- `OK`
- `보완필요`

### 2.2 전이 표
| from | to | 트리거 | 권한 | 이벤트 |
|---|---|---|---|---|
| 미업로드 | 검토중 | 업로드 직후 자동 | system | `DOCUMENT_UPLOADED` |
| 검토중 | OK | 검토 결과 OK 확정 | partner/ops | `DOCUMENT_REVIEWED(decision=OK)` |
| 검토중 | 보완필요 | 검토 결과 보완필요 확정 | partner/ops | `DOCUMENT_REVIEWED(decision=보완필요)` + `FIX_REQUEST_SENT` |
| 보완필요 | 검토중 | 보완 서류 업로드 | user | `FIX_SUBMITTED` + `DOCUMENT_UPLOADED` |
| OK | 검토중 | 새 버전 업로드(재검토) | user/partner | `DOCUMENT_UPLOADED` |

---

## 3) 견적 상태(`quotes.status`)

### 3.1 상태
- `draft` : 자동 산출/초안
- `finalized` : 파트너/운영 확정(승인 게이트 통과)
- `accepted` : 사용자 동의/수락 완료
- `expired` : 유효기간 만료(선택)

### 3.2 전이 표
| from | to | 트리거 | 권한 | 이벤트 |
|---|---|---|---|---|
| (없음) | draft | 견적 요청 | user/system | `QUOTE_REQUESTED` |
| draft | finalized | `POST /quote/finalize` | partner/ops | `QUOTE_FINALIZED` (+ 승인 로그) |
| finalized | accepted | `POST /quote/accept` | user | `QUOTE_ACCEPTED` |
| * | expired | 시간 경과 | system | `QUOTE_EXPIRED` |

---

## 4) 결제 상태(`payments.status`)

### 4.1 상태
- `authorized` : 결제 승인(카드 승인 등)
- `captured` : 매입/정산 가능한 상태
- `failed` : 실패
- `cancelled` : 취소(승인 취소 포함)

### 4.2 전이 표
| from | to | 트리거 | 권한 | 이벤트 |
|---|---|---|---|---|
| (없음) | authorized | PG 승인 성공 | system | `PAYMENT_AUTHORIZED` |
| authorized | captured | PG 매입 성공 | system | `PAYMENT_CAPTURED` |
| (없음) | failed | 승인 실패 | system | `PAYMENT_FAILED` |
| authorized | cancelled | 승인 취소 | ops/system | `PAYMENT_CANCELLED` |

---

## 5) 환불 상태(`refunds.status`)

### 5.1 상태
- `requested`
- `approved`
- `executed`
- `rejected`

### 5.2 전이 표
| from | to | 트리거 | 권한 | 이벤트 |
|---|---|---|---|---|
| (없음) | requested | 사용자/CS 환불 요청 | user/ops | `REFUND_REQUESTED` |
| requested | approved | 환불 승인(정책/사건상태 기반) | ops/system | `REFUND_APPROVED` |
| requested | rejected | 환불 거절 | ops | `REFUND_REJECTED` |
| approved | executed | PG 환불 집행 성공 | system | `REFUND_EXECUTED` |

---

## 6) 정산 상태(`settlements_to_partner.status`)

### 6.1 상태
- `created` : 정산 대상 계산 완료(지급 대기)
- `paid` : 지급 완료
- `void` : 무효(환불/오류로 재계산 필요)

### 6.2 전이 표
| from | to | 트리거 | 권한 | 이벤트 |
|---|---|---|---|---|
| (없음) | created | 배치 생성 | ops/system | `SETTLEMENT_TO_PARTNER_CREATED` |
| created | paid | 지급 완료 | ops/system | `SETTLEMENT_TO_PARTNER_PAID` |
| created | void | 취소/재계산 | ops/system | `SETTLEMENT_VOIDED` |

---

## 7) 운영 상태(SLA/리스크)

### 7.1 SLA 브리치
- 이벤트: `SLA_AT_RISK_DETECTED` (임박/사전 경고)
- 이벤트: `SLA_BREACH_DETECTED`
- 후속: `CASE_ESCALATED_TO_OPS`로 라우팅(자동 또는 수동)

### 7.2 리스크 플래그
- 이벤트: `RISK_FLAGGED`
- 후속: `manual_review` 전환(ops 승인 필요)
