# SLA 정책(측정/브리치/자동화) — v1

목표: SLA는 “약속”이 아니라 **측정 가능한 타이머**여야 하며, 브리치 시 자동화/에스컬레이션이 가능해야 한다.  
운영을 AI에게 맡길수록, SLA는 “AI가 개입할 타이밍”을 결정하는 핵심 신호가 된다.

참조:
- 이벤트 카탈로그: `02-engine/events/domain_events.md`
- 상태 머신: `02-engine/04-state-machines.md`
- Ops 콘솔: `09-ops/01-ops-console-requirements.md`
- 관측/알림: `11-platform/01-observability-and-alerting.md`

---

## 0) SLA 종류(최소 3종)

### SLA-1 최초 착수(First Response / First Touch)
- 정의: `CASE_CREATED` 이후 파트너가 “착수” 의사를 보일 때까지의 시간

### SLA-2 보완 요청 처리(User Waiting)
- 정의: `FIX_REQUEST_SENT` 이후 사용자가 보완을 제출(`FIX_SUBMITTED`)하기까지의 허용 대기 시간
- 목적: 무한 대기를 방지(케이스 정리/취소 정책)

### SLA-3 사건 완료(Completion)
- 정의: 케이스가 `in_progress`로 진입한 시점 이후 `completed`까지의 목표 시간(사건팩별 상이)

> 사건팩(Case Pack)에서 SLA 기본값/오버라이드를 제공하도록 확장 가능.

---

## 1) 측정 규칙(시작/정지/일시정지)

### 1.1 SLA-1 최초 착수
- Start: `CASE_CREATED.occurredAt`
- Stop: (권장 이벤트) `CASE_ACCEPTED` 또는 파트너 첫 응답 이벤트
  - 아직 카탈로그에 없으므로, v1에서는 다음 중 하나로 대체:
    - `QUOTE_FINALIZED`(첫 응답으로 간주) 또는
    - `DOCUMENT_REVIEW_REQUESTED`(파트너 액션으로 간주)
- Pause: 없음(단순)

### 1.2 SLA-2 보완 요청 처리
- Start: `FIX_REQUEST_SENT.occurredAt`
- Stop: `FIX_SUBMITTED.occurredAt` 또는 케이스 취소/종료
- Pause: 사용자 사유(합의된 연장) 시 `SLA_PAUSED`(권장 신규 이벤트)로 처리

### 1.3 SLA-3 사건 완료
- Start: `cases.status`가 `in_progress`로 전환된 시각(또는 파트너 수락)
- Stop: `cases.status=completed` (권장 이벤트: `CASE_COMPLETED`)
- Pause:
  - `waiting_user` 구간은 pause(사용자 대기)
  - `manual_review` 구간은 pause 또는 별도 SLA로 분리(정책 결정)

---

## 2) SLA 목표값(정책 값)

초기 권장(예시, 실제는 사업/사건팩/파트너 등급에 따라 설정):
- SLA-1: 2시간(업무시간), 12시간(비업무시간)
- SLA-2: 7일(기본), 사건팩별 조정
- SLA-3: 사건팩별(예: 임원변경 3~5영업일 등)

파트너 등급별 가중:
- Pro: 목표 더 엄격, 브리치 페널티 큼
- Basic: 목표 완화 가능(단, 노출/추천에 불리)

---

## 3) 브리치 감지 로직(이벤트/배치)

### 3.1 실시간 감지(권장)
조건:
- 각 SLA 타이머를 주기적으로 평가(예: 5분)
- 임박(threshold) / 브리치(breach) 구분

발행 이벤트:
- 임박: (권장 신규) `SLA_AT_RISK_DETECTED`
- 브리치: `SLA_BREACH_DETECTED` (기존 이벤트)

### 3.2 브리치 이벤트 페이로드(확장 제안)
`SLA_BREACH_DETECTED.data`에 포함 권장:
- `slaName`(SLA-1/2/3)
- `breachAt`
- `caseId`, `partnerId`
- `elapsedMinutes`
- `targetMinutes`

---

## 4) 브리치 대응(자동화/에스컬레이션)

### 4.1 임박(At-Risk) 대응
자동(가능):
- Ops 콘솔 `SLA At-Risk Queue`에 적재
- 파트너/사용자 알림 “초안” 생성(AI)

승인 필요:
- 외부 메시지 발송(정책/톤)

### 4.2 브리치(Breach) 대응
필수:
- `SLA_BREACH_DETECTED` 발행
- `CASE_ESCALATED_TO_OPS` 라우팅(수동검토 큐)

권장 자동 조치(정책 기반):
- 파트너 재촉 알림(승인)
- 일정 횟수 이상 반복 시 재배정 후보 생성
- 파트너 품질 지표에 반영(랭킹/노출)

---

## 5) SLA와 랭킹/노출의 연결(중요)

원칙:
- 브리치가 잦은 파트너는 비광고 추천에서 불리
- 광고(스폰서)도 최소 품질 기준 미달이면 노출 금지(정책 문서 참조)

지표 반영:
- `partner_quality_metrics_daily.sla_breach_rate`
- 랭킹 엔진이 `sla_breach_rate`를 패널티로 적용

---

## 6) 운영 AI 위임 포인트

AI 가능:
- 임박/브리치 후보 탐지 요약
- 원인 추정(최근 이벤트/대기 상태 기반)
- 권장 액션 제안(재촉/재배정/동결)

AI 금지(승인 필요):
- 파트너 강제 재배정/정지 확정
- 사용자에게 나가는 메시지 발송 확정

