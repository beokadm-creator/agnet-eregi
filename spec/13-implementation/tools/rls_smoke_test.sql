-- RLS 스모크 테스트(로컬)
-- 전제:
-- - 0001, 0002 마이그레이션 적용
-- - 시드 로드 후 partners 2개 이상 존재
--
-- 실행(예):
-- psql "postgres://app:app@localhost:5432/registry_platform" -f spec/13-implementation/tools/rls_smoke_test.sql

\echo '== RLS smoke test =='

-- 파트너 2개 선택
WITH p AS (
  SELECT id, external_id, verification FROM partners ORDER BY external_id LIMIT 2
)
SELECT * FROM p;

-- 테스트 케이스: partner A 소유 케이스 1개 생성 (ops 권한으로)
DO $$
DECLARE
  p1 uuid;
  p2 uuid;
  s  uuid;
  c  uuid;
BEGIN
  SELECT id INTO p1 FROM partners ORDER BY external_id LIMIT 1;
  SELECT id INTO p2 FROM partners ORDER BY external_id OFFSET 1 LIMIT 1;
  IF p1 IS NULL OR p2 IS NULL THEN
    RAISE EXCEPTION 'partners가 2개 이상 필요합니다.';
  END IF;

  -- ops 스코프 주입
  PERFORM set_config('app.actor_type','ops',true);
  PERFORM set_config('app.partner_id',p1::text,true);

  INSERT INTO sessions DEFAULT VALUES RETURNING id INTO s;
  INSERT INTO cases (session_id, partner_id, case_pack_id, status, risk_level)
  VALUES (s, p1, 'corp_officer_change_v1', 'in_progress', 'low')
  RETURNING id INTO c;

  RAISE NOTICE 'created case % for partner %', c, p1;

  -- partner A: 케이스 조회 가능
  PERFORM set_config('app.actor_type','partner',true);
  PERFORM set_config('app.partner_id',p1::text,true);
  IF (SELECT count(*) FROM cases WHERE id=c) <> 1 THEN
    RAISE EXCEPTION 'partner A는 자신의 케이스를 봐야 합니다.';
  END IF;

  -- partner B: 케이스 조회 불가
  PERFORM set_config('app.actor_type','partner',true);
  PERFORM set_config('app.partner_id',p2::text,true);
  IF (SELECT count(*) FROM cases WHERE id=c) <> 0 THEN
    RAISE EXCEPTION 'partner B는 partner A 케이스를 보면 안 됩니다.';
  END IF;

  -- ops: 전체 조회 가능
  PERFORM set_config('app.actor_type','ops',true);
  IF (SELECT count(*) FROM cases WHERE id=c) <> 1 THEN
    RAISE EXCEPTION 'ops는 케이스를 볼 수 있어야 합니다.';
  END IF;

  RAISE NOTICE 'RLS cases: OK';
END$$;

\echo '== OK =='

