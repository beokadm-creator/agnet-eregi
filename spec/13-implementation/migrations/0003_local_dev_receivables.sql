-- 로컬 개발용 미수금(파트너 회수/상계) 테이블 (v1)
-- 전제: 0001, 0002 적용

BEGIN;

CREATE TABLE IF NOT EXISTS partner_receivables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id     uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  case_id       uuid REFERENCES cases(id) ON DELETE SET NULL,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open','offset_applied','waived','collected')),
  reason_ko     text NOT NULL,
  source_event_id uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_receivables_partner_status
  ON partner_receivables (partner_id, status, created_at);

CREATE TABLE IF NOT EXISTS partner_receivable_offsets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receivable_id  uuid NOT NULL REFERENCES partner_receivables(id) ON DELETE CASCADE,
  settlement_id  uuid NOT NULL REFERENCES settlements_to_partner(id) ON DELETE CASCADE,
  amount        numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  applied_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_receivable_offsets_receivable
  ON partner_receivable_offsets (receivable_id, applied_at DESC);

COMMIT;

