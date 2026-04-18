-- 로컬 개발용 케이스/문서/견적/결제/정산 + RLS 최소 구현 (v1)
-- 목적:
-- - 퍼널 이후(케이스 생성/문서/견적/결제/환불/정산/원장)까지 로컬에서 재현
-- - RLS(Row Level Security) 정책을 실제로 테스트 가능하게 함
--
-- 전제:
-- - 0001_local_dev_core.sql 이 먼저 적용되어야 함

BEGIN;

-- 0) 세션 변수 기반 "현재 사용자/파트너" 헬퍼
-- 앱에서는 요청마다 아래 세션 변수를 SET LOCAL로 주입한다고 가정:
--   app.actor_type = 'user' | 'partner' | 'ops' | 'system'
--   app.user_id = '<uuid or text>'
--   app.partner_id = '<partner uuid>'  (partner 콘솔/ops에서 partner scope가 필요할 때)
--   app.session_id = '<sessionId>'
CREATE OR REPLACE FUNCTION current_actor_type()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(current_setting('app.actor_type', true), 'anonymous')
$$;

CREATE OR REPLACE FUNCTION current_user_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.user_id', true)
$$;

CREATE OR REPLACE FUNCTION current_partner_uuid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT NULLIF(current_setting('app.partner_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION current_session_id()
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT current_setting('app.session_id', true)
$$;

-- 1) 세션/케이스
CREATE TABLE IF NOT EXISTS sessions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id     text UNIQUE,
  user_id         text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS cases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text,
  session_id      uuid REFERENCES sessions(id),
  partner_id      uuid REFERENCES partners(id),
  case_pack_id    text NOT NULL,
  status          text NOT NULL DEFAULT 'new',
  risk_level      text NOT NULL DEFAULT 'low',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cases_partner_updated ON cases (partner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_cases_user_updated ON cases (user_id, updated_at DESC);

-- 2) 문서/버전/검토(최소)
CREATE TABLE IF NOT EXISTS documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  slot_id       text,
  title_ko      text,
  status        text NOT NULL DEFAULT '미업로드',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_case_slot ON documents (case_id, slot_id);

CREATE TABLE IF NOT EXISTS document_versions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id        uuid NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  file_name          text NOT NULL,
  mime_type          text NOT NULL,
  size_bytes         bigint NOT NULL,
  sha256             text,
  storage_ref        text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  created_by_actor_type text NOT NULL,
  created_by_actor_id   text
);

CREATE INDEX IF NOT EXISTS idx_doc_versions_doc_time ON document_versions (document_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id            uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  status             text NOT NULL DEFAULT 'requested',
  requested_by_actor_type text NOT NULL,
  requested_by_actor_id   text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_decisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_request_id  uuid NOT NULL REFERENCES review_requests(id) ON DELETE CASCADE,
  decision           text NOT NULL,
  issues_json        jsonb NOT NULL DEFAULT '[]'::jsonb,
  decided_by_actor_type text NOT NULL,
  decided_by_actor_id   text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- 3) 견적/결제/환불/정산/원장(최소)
CREATE TABLE IF NOT EXISTS quotes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id         uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  partner_id      uuid REFERENCES partners(id),
  price_min       numeric NOT NULL,
  price_max       numeric NOT NULL,
  currency        text NOT NULL DEFAULT 'KRW',
  eta_min_hours   numeric NOT NULL,
  eta_max_hours   numeric NOT NULL,
  assumptions_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  status          text NOT NULL DEFAULT 'draft',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_consents (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id             uuid NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  user_id              text,
  consented            boolean NOT NULL,
  consent_text_version text,
  consented_at         timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS payments (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id       uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  quote_id      uuid REFERENCES quotes(id),
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  method        text NOT NULL,
  pg            text NOT NULL,
  pg_auth_key   text,
  status        text NOT NULL DEFAULT 'authorized',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS refunds (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id     uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  case_id       uuid NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  reason_ko     text NOT NULL,
  status        text NOT NULL DEFAULT 'requested',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settlements_to_partner (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid NOT NULL REFERENCES partners(id),
  case_id       uuid REFERENCES cases(id),
  gross_amount  numeric NOT NULL,
  platform_fee  numeric NOT NULL,
  net_amount    numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  status        text NOT NULL DEFAULT 'created',
  created_at    timestamptz NOT NULL DEFAULT now(),
  paid_at       timestamptz,
  payout_method text NOT NULL DEFAULT 'bank_transfer',
  bank_ref      text
);

CREATE TABLE IF NOT EXISTS ledger_entries (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  occurred_at   timestamptz NOT NULL,
  case_id       uuid,
  partner_id    uuid,
  event_id      uuid,
  account_code  text NOT NULL,
  dr_amount     numeric NOT NULL DEFAULT 0,
  cr_amount     numeric NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'KRW',
  memo_ko       text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 4) 감사 로그(최소)
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type    text NOT NULL,
  actor_id      text,
  action        text NOT NULL,
  target_type   text NOT NULL,
  target_id     text,
  reason_ko     text,
  meta_json     jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 5) RLS 적용(케이스/문서/견적/결제/환불/정산)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements_to_partner ENABLE ROW LEVEL SECURITY;

-- 5.1 cases: partner는 자기 partner_id, user는 자기 user_id, ops/system은 전체
DROP POLICY IF EXISTS cases_policy_all ON cases;
CREATE POLICY cases_policy_all ON cases
  USING (
    current_actor_type() IN ('ops','system')
    OR (current_actor_type()='partner' AND partner_id = current_partner_uuid())
    OR (current_actor_type()='user' AND user_id IS NOT NULL AND user_id = current_user_id())
  );

-- 5.2 documents/document_versions: case를 통해 상속
DROP POLICY IF EXISTS documents_policy_all ON documents;
CREATE POLICY documents_policy_all ON documents
  USING (
    EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = documents.case_id
        AND (
          current_actor_type() IN ('ops','system')
          OR (current_actor_type()='partner' AND c.partner_id = current_partner_uuid())
          OR (current_actor_type()='user' AND c.user_id = current_user_id())
        )
    )
  );

DROP POLICY IF EXISTS document_versions_policy_all ON document_versions;
CREATE POLICY document_versions_policy_all ON document_versions
  USING (
    EXISTS (
      SELECT 1
      FROM documents d
      JOIN cases c ON c.id = d.case_id
      WHERE d.id = document_versions.document_id
        AND (
          current_actor_type() IN ('ops','system')
          OR (current_actor_type()='partner' AND c.partner_id = current_partner_uuid())
          OR (current_actor_type()='user' AND c.user_id = current_user_id())
        )
    )
  );

-- 5.3 quotes/payments/refunds/settlements_to_partner: case/partner 상속
DROP POLICY IF EXISTS quotes_policy_all ON quotes;
CREATE POLICY quotes_policy_all ON quotes
  USING (
    current_actor_type() IN ('ops','system')
    OR (current_actor_type()='partner' AND partner_id = current_partner_uuid())
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = quotes.case_id
        AND current_actor_type()='user'
        AND c.user_id = current_user_id()
    )
  );

DROP POLICY IF EXISTS payments_policy_all ON payments;
CREATE POLICY payments_policy_all ON payments
  USING (
    current_actor_type() IN ('ops','system')
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = payments.case_id
        AND (
          (current_actor_type()='partner' AND c.partner_id = current_partner_uuid())
          OR (current_actor_type()='user' AND c.user_id = current_user_id())
        )
    )
  );

DROP POLICY IF EXISTS refunds_policy_all ON refunds;
CREATE POLICY refunds_policy_all ON refunds
  USING (
    current_actor_type() IN ('ops','system')
    OR EXISTS (
      SELECT 1 FROM cases c
      WHERE c.id = refunds.case_id
        AND (
          (current_actor_type()='partner' AND c.partner_id = current_partner_uuid())
          OR (current_actor_type()='user' AND c.user_id = current_user_id())
        )
    )
  );

DROP POLICY IF EXISTS settlements_policy_all ON settlements_to_partner;
CREATE POLICY settlements_policy_all ON settlements_to_partner
  USING (
    current_actor_type() IN ('ops','system')
    OR (current_actor_type()='partner' AND partner_id = current_partner_uuid())
  );

COMMIT;
