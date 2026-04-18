# 운영 관측(Observability) & 알림(Alerts) — v1

목표: 운영을 AI에게 위임해도 “서비스가 멈추지 않게” 하기 위해, 로그/메트릭/트레이싱/알림/SLO를 고정한다.  
원칙: 문제를 **탐지(Detect) → 분류(Triage) → 완화(Mitigate) → 복구(Recover) → 재발방지(Prevent)** 하는 루프를 만든다.

---

## 0) 관측 레이어 구성

### 0.1 3대 신호
- Logs: 원인 파악(why)
- Metrics: 상태 감지(what/how much)
- Traces: 병목/의존성 추적(where)

### 0.2 표준 태그(필수)
모든 로그/메트릭/트레이스에 공통으로 붙을 키:
- `service` (api_gateway, doc_review_engine, payment_service, ops_console 등)
- `env` (prod/stage/dev)
- `version` (git sha or semver)
- `requestId`, `correlationId` (가능한 경우)
- `caseId`, `partnerId` (민감도 낮은 범위에서)

> `requestId/correlationId`는 `02-engine/events/case_event.schema.json`의 trace와 일치해야 함.

---

## 1) SLO/SLI (서비스 수준 목표)

### 1.1 사용자 퍼널 핵심 API SLO(예시)
- `/v1/intent`, `/v1/diagnosis/answer`, `/v1/results`
  - 가용성: 99.9%
  - p95 지연: 800ms(예시)

### 1.2 문서 업로드/검토 SLO(예시)
- 업로드 API: 가용성 99.9%, p95 1.5s(네트워크 제외)
- 비동기 OCR/분류: p95 5분 이내 완료(예시)

### 1.3 결제/환불 SLO(예시)
- 결제 승인/매입 처리: 실패율 < 0.5%
- 환불 집행: p95 10분 이내(예시, PG에 따라)

> 실제 수치는 운영/비즈니스가 정하되, 시스템은 SLO 정의/측정/알림이 가능해야 함.

---

## 2) 대시보드(필수)

### 2.1 제품 퍼널(비즈니스)
참조: `02-engine/05-analytics-taxonomy.md`
- 홈→진단 시작률, 진단 완료율, 파트너 선택률
- TTFU, 보완요청률, SLA 준수율

### 2.2 운영/시스템
- API 요청량/에러율/지연(p50/p95/p99)
- 큐 적체(Manual review/Approval/SLA/Refund)
- 문서 업로드 실패율/악성 차단율
- 결제/환불 실패율(의존성별)
- 이벤트 저장소 지연(ingestion lag)

---

## 3) 알림(Alerts) — “밤에 깨울 것”만

### 3.1 알림 등급
- P0: 즉시 대응(서비스 중단/결제 장애/데이터 유출)
- P1: 1시간 내 대응(지연 급증/큐 적체)
- P2: 업무 시간 내 대응(일시적 스파이크, 경미한 오류)

### 3.2 필수 알림 규칙(예시)

#### A) API 오류율 급증(P0/P1)
- 조건: 특정 엔드포인트 5xx 비율 > X% (5분)
- 라우팅: on-call + AI triage(요약) + 런북 링크

#### B) 결제 장애(P0)
- 조건: `PAYMENT_AUTHORIZED` 대비 실패율 급증, PG 5xx 증가
- 조치: 결제 기능 플래그 OFF(임시), 사용자 안내 템플릿 발송(승인게이트)

#### C) 이벤트 저장 지연(P0)
- 조건: ingestion lag > X분
- 영향: 감사/정산/대사 모두 깨짐 → 즉시 대응

#### D) 운영 큐 적체(P1)
- 조건: Manual review 큐 건수 > 임계치 또는 평균 대기시간 > 임계치
- 조치: 자동 우선순위 재정렬 + 인력/파트너 재배치 제안

#### E) 문서 업로드 실패/악성 증가(P1/P2)
- 조건: 413/415/악성 차단율 급증
- 조치: 정책/제한치 확인, 공격 여부 판단

---

## 4) 런북(Runbook) & 인시던트 대응

### 4.1 인시던트 템플릿(필수 정보)
- 증상: 무엇이/언제부터/어느 범위에서
- 영향: 사용자 수, 결제 영향, 데이터 손상 여부
- 원인 가설: 상위 3개
- 완화: 기능 플래그/롤백/레이트리밋 강화
- 복구: 정상화 확인 지표
- 사후: 재발 방지 티켓/정책 업데이트

### 4.2 기능 플래그(필수)
엔진/기능별 on/off:
- doc_review_engine, payment, sponsor, messaging, ai_ops_automation 등

---

## 5) AI 운영과 관측의 결합(중요)

AI가 운영을 하려면 “관측 데이터가 입력”이어야 한다.

### 5.1 AI Triage 입력(필수)
- 최근 15분 에러율/지연/의존성 실패
- 관련 배포 버전/변경 이력
- 큐 적체/브리치 건수
- 대표 케이스 샘플(PII 제거)

### 5.2 AI Triage 출력(필수)
- 요약(5~10줄)
- 근거(메트릭/로그/트레이스 링크)
- 우선 조치 1~3개 + 위험도
- “사람 승인 필요” 액션 분리(메시지 발송/환불 등)

> AI triage는 `09-ops/02-ai-ops-automation.md`의 WU-01/05와 연결된다.

