# 로컬 실행 가이드(초안) — v1

목표: 개발자가 로컬에서 DB/스토리지/시드를 올리고, 스펙의 시나리오를 재현할 수 있게 한다.

참조:
- docker-compose: `13-implementation/docker-compose.dev.yml`
- 시드/로컬 플로우: `13-implementation/04-seed-and-local-dev.md`
- 시드 파일:
  - `13-implementation/seeds/partners.seed.json`
  - `13-implementation/seeds/ads.seed.json`
  - `13-implementation/seeds/case_events.sample.jsonl`

---

## 1) 의존성
- Docker / Docker Compose
- (선택) psql 또는 DB GUI
- Python 3.10+ (권장)

파이썬 패키지(로컬):
```bash
pip install -r spec/13-implementation/tools/requirements.local.txt --break-system-packages
```

---

## 2) 인프라 기동

```bash
docker compose -f spec/13-implementation/docker-compose.dev.yml up -d
```

확인:
- Postgres: `localhost:5432` (db: `registry_platform`, user/pass: `app/app`)
- MinIO:
  - API: `http://localhost:9000`
  - Console: `http://localhost:9001` (minio/minio12345)

---

## 3) DB 마이그레이션(개념)

본 spec는 DB 구조를 `spec/08-data/01-db-model.md`에 정의했으며,
실제 구현에서는 `packages/db/migrations` 같은 위치에 마이그레이션을 둡니다.

로컬 최소 스키마(시드/이벤트 적재용):
- `spec/13-implementation/migrations/0001_local_dev_core.sql`
- `spec/13-implementation/migrations/0002_local_dev_case_money_rls.sql` (케이스/문서/결제/정산 + RLS)

적용(예, psql 설치 시):
```bash
psql "postgres://app:app@localhost:5432/registry_platform" -f spec/13-implementation/migrations/0001_local_dev_core.sql
psql "postgres://app:app@localhost:5432/registry_platform" -f spec/13-implementation/migrations/0002_local_dev_case_money_rls.sql
psql "postgres://app:app@localhost:5432/registry_platform" -f spec/13-implementation/migrations/0003_local_dev_receivables.sql
```

권장:
1) `domain_events`(append-only) + RLS 정책 먼저
2) partners/cases/documents
3) quotes/payments/refunds/settlements/ledger

---

## 4) 시드 주입(개념)

시드 파일은 JSON으로 제공되며, 구현체가 아래를 수행:
- partners + partner_profiles + capabilities 로드
- ad_campaigns 로드(선택)
- (선택) case_events JSONL을 domain_events에 적재해 replay 테스트

시드 파일:
- `spec/13-implementation/seeds/partners.seed.json`
- `spec/13-implementation/seeds/ads.seed.json`
- `spec/13-implementation/seeds/case_events.sample.jsonl`

로컬 로더(초안):
- `spec/13-implementation/tools/seed_postgres.py`
- `spec/13-implementation/tools/load_domain_events.py`
- `spec/13-implementation/tools/validate_contracts.py`
- `spec/13-implementation/tools/replay_case_snapshot.py` (이벤트 → 스냅샷 재구성 스캐폴딩)
- `spec/13-implementation/tools/run_local_demo.py` (원클릭 러너: 검증→마이그→시드→이벤트→리플레이)

계약 검증(권장, CI와 동일):
```bash
python spec/13-implementation/tools/validate_contracts.py
```

원클릭(권장):
```bash
python spec/13-implementation/tools/run_local_demo.py
```

인프라까지 포함한 원클릭(옵션):
```bash
python spec/13-implementation/tools/run_local_demo.py --docker-up
```

환불/정산 리플레이 참고:
- 샘플 이벤트에는 정산 지급 후 부분 환불이 포함되어 있으며,
  리플레이는 이 경우 `A_PARTNER_RECEIVABLE`(파트너 미수금)으로 처리합니다(단순 규칙).

시드 재실행:
- `partners`는 `external_id` 기준 upsert(중복 생성 방지)

---

## 5) 최소 재현 체크(스펙 기준)

1) 퍼널 API(`/intent`→`/diagnosis/answer`→`/results`)가 카드 계약을 만족  
2) 케이스 생성 후 문서 업로드/검토 이벤트가 `domain_events`에 쌓임  
3) 샌드박스 결제 이벤트로 정산/원장 분개까지 생성  
4) RLS가 실제로 작동(다른 partner_id 케이스 접근 차단)  

RLS 테스트(개념):
```sql
-- partner scope 주입 예시
SET LOCAL app.actor_type = 'partner';
SET LOCAL app.partner_id = '<partner_uuid>';
SELECT count(*) FROM cases;
```

RLS 스모크 테스트(스크립트):
```bash
psql "postgres://app:app@localhost:5432/registry_platform" -f spec/13-implementation/tools/rls_smoke_test.sql
```

---

## 6) 운영 AI(선택) 테스트 연결

운영 AI는 로컬에서도 아래 입력을 통해 triage가 가능해야 합니다.
- 큐 적체(건수)
- 최근 에러율/지연
- 샘플 케이스 타임라인(PII 제거)

참조:
- `09-ops/02-ai-ops-automation.md`
- `11-platform/01-observability-and-alerting.md`
