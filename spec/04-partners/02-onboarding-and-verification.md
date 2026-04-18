# 파트너 온보딩/검증(Verified/Pro) — v1

목표: 파트너(법무사사무소/법무법인/법률사무소)를 “다방/직방형 플랫폼”으로 대량 온보딩하려면,
1) 입점 절차가 **표준화**되어야 하고  
2) 등급(Basic/Verified/Pro)이 **정의/근거/갱신/정지**까지 포함해 운영 가능해야 하며  
3) 광고/추천/정산/분쟁 대응이 **데이터와 로그**로 증빙 가능해야 합니다.

참조:
- 파트너 플랫폼 개요: `04-partners/01-partner-platform.md`
- 파트너 프로필 스키마(단일 소스): `spec_partner_profile_schema.yaml`
- 파트너 최소 계약(JSON): `02-engine/contracts/partner_profile.schema.json`
- 추천/광고 정책: `06-policies/01-recommendation-ads-offline.md`
- Ops 콘솔: `09-ops/01-ops-console-requirements.md`
- 보안/RBAC/RLS: `10-security/01-auth-rbac-rls.md`

---

## 0) 기본 개념

### 0.1 파트너 등급(3단)
- **Basic**: 입점 완료(최소 정보/최소 약관 동의/최소 정산 정보)
- **Verified**: 신원/자격/사업 정보 검증 완료 + 최소 품질 기준 충족
- **Pro**: Verified + 추가 검증 + 운영 성과/SLA/팀 운영 요건 충족(또는 구독 플랜)

> 등급은 “법률 결과 보증”이 아니며, “플랫폼 기준의 검증 절차를 통과했다”는 의미로만 사용(고지 필수).

### 0.2 온보딩의 산출물(플랫폼이 필요한 데이터)
온보딩 완료 시 확보해야 할 최소 데이터:
- identity: 상호/대표/주소/연락처(PII 분리 가능), 사업자/법인 정보
- license: 법무사 등록/법인 등 자격 확인(증빙 파일)
- payout: 정산 계좌/세금계산서 발행 정보(증빙)
- capabilities: 수행 가능 사건팩 + 제외 조건
- pricing: 가격 룰(DSL) 또는 최소 가격 범위
- sla/capacity: 착수/완료 목표, 수용량
- compliance: 광고/추천/책임분리/개인정보 위탁 동의

---

## 1) 온보딩 상태 머신(Partner Onboarding)

권장 상태:
- `draft` : 임시 저장(등록 미완료)
- `submitted` : 제출 완료(심사 대기)
- `under_review` : 심사 중(Ops/자동 검증)
- `needs_fix` : 보완 요청(서류/정보 누락)
- `approved` : 승인(입점 완료)
- `rejected` : 반려(사유 기록)
- `suspended` : 정지(정책 위반/품질 미달)

필수 이벤트(도메인/운영 이벤트로 확장 가능):
- `PARTNER_ONBOARDING_SUBMITTED`
- `PARTNER_ONBOARDING_NEEDS_FIX`
- `PARTNER_ONBOARDING_APPROVED`
- `PARTNER_ONBOARDING_REJECTED`
- `PARTNER_GRADE_CHANGED`
- `PARTNER_SUSPENDED` / `PARTNER_REINSTATED`
- `PARTNER_PROFILE_UPDATED`

참조:
- 이벤트 카탈로그: `02-engine/events/domain_events.md`
- 이벤트 envelope 계약(JSON Schema): `02-engine/events/case_event.schema.json`

---

## 2) 온보딩 플로우(단계별)

### Step 0) 파트너 계정/조직 생성
입력:
- 이메일/휴대폰(파트너 계정)
- 조직 유형 선택(법무사사무소/법무법인/법률사무소)

권장:
- 조직(Partner) 생성 후, `partner_admin` 역할 계정 1개를 부여
- 2FA는 Verified/Pro에서 강권

### Step 1) 기본 프로필 입력(초기 노출 금지)
- 상호명, 주소(지도), 대표/담당자, 연락처
- 방문 가능 여부/영업시간(선택)
- 서비스 지역/관할(필터)

검증:
- 주소/전화번호 형식 검증
- 지도 좌표 유효성

### Step 2) 자격/신원 증빙 업로드(검증의 핵심)
필수(예시):
- 법무사 등록/자격 증빙(또는 법인 등기/변호사 등 해당 유형 증빙)
- 사업자등록증/법인등록번호(해당 시)
- 사무소 소재지 증빙(선택)

정책:
- 문서 저장/보관은 `10-security/02-document-storage-and-retention.md`를 준수
- OCR/추출은 PII 취급(접근 제한)

### Step 3) 정산/세무 정보 등록
필수:
- 정산 계좌(암호화/PII)
- 세금계산서/정산명세서 수신 이메일(선택)

검증(권장):
- 계좌 실명 인증(가능한 범위)

### Step 4) 역량/사건팩/가격/용량 설정
- 수행 가능 사건팩 선택(최소 1개)
- 가격 룰:
  - 최소: 사건팩별 `min~max` 범위
  - 고급: `spec_pricing_rules_dsl.yaml` 기반 룰 등록
- 용량:
  - activeCaseLimit / availableNow
- SLA:
  - 착수/완료 목표(등급별 최소 요구)

검증(권장):
- 가격이 비정상(0원, 과도한 범위)일 경우 보류/보완

### Step 5) 약관/정책 동의(필수)
필수 동의:
- 플랫폼 책임 분리/광고 라벨 정책 준수
- 개인정보 처리 위탁(문서/연락)
- 운영 정책(보완요청, SLA, 분쟁 처리)

동의 증빙:
- `consentTextVersion`, 동의 시각/actor, IP/UA 저장(감사)

### Step 6) 심사(자동 + 수동)
자동 심사(가능):
- 필수 서류 제출 여부, 형식 검사
- 중복/사기 탐지(전화/주소/계좌 중복)
- 기초 품질 기준(응답 SLA 설정, 필수 필드 완결성)

수동 심사(Ops):
- 자격 증빙 진위 확인(샘플링/전수 정책 결정)
- 허위/과장 프로필 여부

결과:
- approved / needs_fix / rejected

### Step 7) 공개/노출
승인 이후에도 2단계로 나눔(권장):
- `approved_not_listed`: 승인 완료, 노출 전(프로필 검수/샘플 케이스)
- `listed`: 검색/추천 노출

---

## 3) Verified / Pro 등급 규칙(권장 초안)

### 3.1 Basic(입점 완료)
요건:
- 필수 프로필 + 최소 자격/사업 정보 제출
- 정산 정보 등록
- 정책 동의

제한:
- 광고 참여 불가(기본)
- 추천 알고리즘에서 가중치 낮음(품질 데이터 축적 전)

### 3.2 Verified
요건:
- 자격/사업 정보 검증 완료(Ops/자동)
- 최소 품질 기준:
  - 최근 30일 `sla_breach_rate` < 임계치(초기에는 0~N건 허용 정책)
  - 보완요청률/클레임률 임계치 이하(초기에는 “측정만” 가능)

혜택(예):
- 품질 추천에서 정상 가중치
- 광고 참여 자격(단, 최소 품질 기준 유지)

### 3.3 Pro
요건(예시):
- Verified + 2FA 활성화
- 팀 계정/역할(권장)
- SLA 목표 더 엄격 또는 Pro 구독 플랜
- 일정 처리량/완료율 기준(선택)

혜택:
- 추천 상위 가중치(단, 광고와 분리)
- 광고 우선 참여 가능
- 업무 OS 고급 기능(템플릿/리포트/자동화)

---

## 4) 광고 자격(스폰서) 체크리스트(필수)

광고 노출은 “돈”보다 “신뢰”가 더 중요하므로, 자동 차단 규칙을 둔다.

필수 조건(예시):
- Verified 또는 Pro
- 최근 30일 SLA 브리치/클레임 임계치 이하
- 허위 프로필/부정 클릭 의심 없음

차단/해제:
- 차단 사유는 기록되고, Ops 콘솔에서 해제는 승인(권장 L2)

---

## 5) 정지/강등/재심사(Enforcement)

### 5.1 트리거
- SLA 반복 브리치
- 분쟁/클레임 급증
- 허위/과장 정보 적발
- 부정 광고 트래픽(클릭 농장 등)

### 5.2 조치 단계(권장)
1) 경고(내부) + 개선 요청
2) 노출 제한(비광고 추천 제외)
3) 광고 중단
4) 등급 강등(Verified→Basic)
5) 정지(suspended) / 퇴출

필수 로그:
- `audit_logs`: `POLICY_ENFORCEMENT_ACTION`, 사유/증빙 링크
- (권장 이벤트) `PARTNER_SUSPENDED`, `PARTNER_REINSTATED`

---

## 6) 운영/AI 자동화 연결 포인트

AI에게 맡길 수 있는 영역:
- 온보딩 제출물 완결성 체크(필수 필드/서류 누락)
- 이상 징후 탐지(중복/급격한 변경/부정 의심)
- 보완 요청 메시지 초안(승인 후 발송)
- 등급 유지 조건 모니터링(SLA/클레임)

AI 금지(승인 필요):
- 최종 승인/반려 확정
- 정지/강등 확정
- 광고 차단/해제 확정(정책 영향)
