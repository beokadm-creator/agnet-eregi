-- 로컬 개발용 최소 스키마 (v1)
-- 목적: spec의 시드(파트너/광고/이벤트/승인)를 실제로 적재하고 리플레이 테스트가 가능하게 한다.
-- 주의: 운영용 완전체 스키마가 아니라 “로컬 재현”을 위한 최소 집합이다.

BEGIN;

-- UUID 생성(선택): gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1) 파트너(입점)
CREATE TABLE IF NOT EXISTS partners (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_id   text UNIQUE,
  name_ko       text NOT NULL,
  type          text NOT NULL CHECK (type IN ('법무사사무소','법무법인','법률사무소')),
  verification  text NOT NULL CHECK (verification IN ('basic','verified','pro')),
  status        text NOT NULL DEFAULT 'active' CHECK (status IN ('active','paused','suspended')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partners_verification_status
  ON partners (verification, status);

CREATE TABLE IF NOT EXISTS partner_profiles (
  partner_id    uuid PRIMARY KEY REFERENCES partners(id) ON DELETE CASCADE,
  profile_json  jsonb NOT NULL,
  address_ko    text,
  region_ko     text,
  lat           double precision,
  lng           double precision,
  visitable     boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_profiles_region ON partner_profiles (region_ko);
CREATE INDEX IF NOT EXISTS idx_partner_profiles_visitable ON partner_profiles (visitable);

CREATE TABLE IF NOT EXISTS partner_casepack_capabilities (
  partner_id    uuid REFERENCES partners(id) ON DELETE CASCADE,
  case_pack_id  text NOT NULL,
  enabled       boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, case_pack_id)
);

-- 2) 광고(스폰서)
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id            text PRIMARY KEY,
  partner_id    uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  status        text NOT NULL CHECK (status IN ('active','paused','ended')),
  budget_amount numeric NOT NULL,
  currency      text NOT NULL DEFAULT 'KRW',
  starts_at     timestamptz NOT NULL,
  ends_at       timestamptz NOT NULL,
  placement_rules jsonb,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_partner_status
  ON ad_campaigns (partner_id, status);

-- 3) 승인 게이트(운영/파트너 확정 행위 통제)
CREATE TABLE IF NOT EXISTS approval_requests (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_gate     text NOT NULL,
  status            text NOT NULL CHECK (status IN ('pending','approved','rejected','cancelled','expired')),
  target_type       text NOT NULL,
  target_ref        text,
  required_role     text,
  summary_ko        text,
  payload_hash      text,
  payload_json      jsonb,
  created_by_actor_type text NOT NULL CHECK (created_by_actor_type IN ('system','partner','ops')),
  created_by_actor_id   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  expires_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_status_created
  ON approval_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_approval_requests_gate_status
  ON approval_requests (approval_gate, status, created_at DESC);

CREATE TABLE IF NOT EXISTS approval_decisions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_request_id uuid NOT NULL REFERENCES approval_requests(id) ON DELETE CASCADE,
  decision            text NOT NULL CHECK (decision IN ('approved','rejected')),
  reason_ko           text,
  decided_by_actor_type text NOT NULL CHECK (decided_by_actor_type IN ('ops','partner')),
  decided_by_actor_id   text,
  decided_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_approval_decisions_req_time
  ON approval_decisions (approval_request_id, decided_at DESC);

-- 4) 이벤트 저장소(append-only)
CREATE TABLE IF NOT EXISTS domain_events (
  id              uuid PRIMARY KEY,
  event_type      text NOT NULL,
  version         text NOT NULL,
  occurred_at     timestamptz NOT NULL,
  producer_service text NOT NULL,
  producer_version text NOT NULL,
  actor_type      text NOT NULL,
  actor_id        text,
  session_id      text,
  case_id         text,
  partner_id      text,
  trace_json      jsonb,
  data_json       jsonb NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_domain_events_case_time
  ON domain_events (case_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_partner_time
  ON domain_events (partner_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_domain_events_type_time
  ON domain_events (event_type, occurred_at);

COMMIT;
