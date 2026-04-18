# 도메인 이벤트(초안) — 토픽/이벤트명/목적

> 이벤트는 “엔진 호출 트리거”이자 “회계/감사”의 뼈대입니다.  
> 본 문서는 이벤트 카탈로그(사람 읽는 문서)이며, 페이로드 계약(JSON)은 다음 단계에서 `events/*.schema.json`로 추가합니다.

## 1) 사용자 퍼널 이벤트(모바일)

- `INTENT_SUBMITTED` : 홈 입력(자연어/카테고리) 제출
- `DIAGNOSIS_ANSWERED` : 진단 문항 응답(누적 입력 업데이트)
- `RESULTS_VIEWED` : 추천/비교 리스트 노출(AB 테스트 지표)
- `PARTNER_SELECTED` : 파트너 선택(온라인 진행 시작)
- `CASE_CREATED` : 사건 생성(파트너 연결 + 사건팩 확정)
- `CASE_ACCEPTED` : 파트너가 사건 수락/착수(최초 착수 SLA 종료 지점)
- `CASE_COMPLETED` : 사건 완료(사건팩 기준 완료)
- `CASE_CANCELLED` : 사건 취소(환불/정산 후속 처리의 기준)

## 2) 문서/검토/보완 이벤트

- `DOCUMENT_UPLOADED` : 파일 업로드(버전 생성)
- `DOCUMENT_CLASSIFIED` : 슬롯 분류 확정(사용자 수정 포함)
- `DOCUMENT_REVIEW_REQUESTED` : 파트너/운영 검토 요청(=AI_DOC_REVIEW 트리거)
- `DOCUMENT_REVIEWED` : 문서 검토 결과 확정(OK/보완필요)
- `FIX_REQUEST_SENT` : 보완 요청 메시지 발송(승인 로그 포함)
- `FIX_SUBMITTED` : 사용자 보완 서류 제출

## 3) 견적/결제/정산 이벤트(요약)

- `QUOTE_REQUESTED` : 견적/ETA 요청(=AI_QUOTE_ETA 트리거)
- `QUOTE_FINALIZED` : 확정 견적(파트너/운영 확정 + 사용자 동의)
- `QUOTE_ACCEPTED` : 사용자 견적 동의/수락(결제 단계 진입 근거)
- `QUOTE_EXPIRED` : 견적 만료(선택)
- `PAYMENT_AUTHORIZED` / `PAYMENT_CAPTURED`
- `PAYMENT_FAILED` / `PAYMENT_CANCELLED` : 결제 실패/취소(대사/CS 근거)
- `REFUND_REQUESTED` / `REFUND_APPROVED` / `REFUND_EXECUTED`
- `REFUND_REJECTED` : 환불 거절(선택)
- `SETTLEMENT_TO_PARTNER_CREATED` / `SETTLEMENT_TO_PARTNER_PAID`
- `SETTLEMENT_VOIDED` : 정산 무효/재계산 필요(선택)

## 4) 매칭/광고/노출 이벤트

- `PARTNER_RANKED` : 랭킹 결과 생성(감사/분쟁 대비)
- `SPONSOR_IMPRESSION` / `SPONSOR_CLICKED` : 광고 노출/클릭(정산)
- `CASE_REASSIGNED` : 파트너 재배정(운영 안전밸브)

## 5) SLA/리스크 이벤트

- `SLA_AT_RISK_DETECTED` : SLA 임박(사전 경고)
- `SLA_BREACH_DETECTED` : SLA 위반 감지
- `RISK_FLAGGED` : 고리스크 플래그(=AI_RISK_ESCALATION 트리거)
- `CASE_ESCALATED_TO_OPS` : 수동검토 큐로 라우팅

## 6) 파트너(입점) 이벤트(권장)

> 파트너 온보딩/검증/정지는 케이스와 무관하게도 발생하므로, 이벤트로 남겨 “광고 자격/노출/정산/감사”에 일관되게 연결합니다.

- `PARTNER_ONBOARDING_SUBMITTED` : 파트너 입점 신청 제출
- `PARTNER_ONBOARDING_NEEDS_FIX` : 보완 요청(서류/정보)
- `PARTNER_ONBOARDING_APPROVED` : 승인(입점 완료)
- `PARTNER_ONBOARDING_REJECTED` : 반려
- `PARTNER_GRADE_CHANGED` : 등급 변경(Basic/Verified/Pro)
- `PARTNER_SUSPENDED` / `PARTNER_REINSTATED` : 정지/해제
- `PARTNER_PROFILE_UPDATED` : 프로필/가격/역량 변경(감사/분쟁 대비)

## 6) 승인 게이트(Approval) 이벤트(권장)

> 운영/파트너가 “확정” 행위를 하기 전후를 이벤트로 남기면 감사/분쟁 대응이 쉬워집니다.

- `APPROVAL_REQUESTED` : 승인 요청 생성(대상=메시지/견적/환불/재배정 등)
- `APPROVAL_APPROVED` : 승인 완료
- `APPROVAL_REJECTED` : 승인 반려

## 7) 운영 강제 조치 이벤트(권장)

- `CASE_FROZEN` / `CASE_UNFROZEN` : 케이스 동결/해제(분쟁/위조 의심 등)
