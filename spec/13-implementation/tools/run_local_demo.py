#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
원클릭 로컬 데모 러너(초안)

하는 일:
1) 계약 검증(validate_contracts.py)
2) (가능하면) psql로 로컬 마이그레이션 적용(0001, 0002)
3) 파트너/광고 시드 적재(seed_postgres.py)
4) 샘플 이벤트 적재(load_domain_events.py)
5) 이벤트 리플레이로 스냅샷/원장 생성(replay_case_snapshot.py)

주의:
- 이 스크립트는 “개발자 편의”용이며, 운영 배포와 무관합니다.
- DB가 떠 있어야 합니다(docker-compose.dev.yml).
"""

import os
import shutil
import subprocess
import sys


def run(cmd, env=None):
    print("+", " ".join(cmd))
    subprocess.check_call(cmd, env=env)

def preflight():
    missing = []
    try:
        import yaml  # noqa: F401
    except Exception:
        missing.append("pyyaml")
    try:
        import jsonschema  # noqa: F401
    except Exception:
        missing.append("jsonschema")
    try:
        import psycopg2  # noqa: F401
    except Exception:
        missing.append("psycopg2-binary")

    if missing:
        print("필수 파이썬 패키지가 없습니다:", ", ".join(missing), file=sys.stderr)
        print(
            "설치(로컬): pip install -r spec/13-implementation/tools/requirements.local.txt --break-system-packages",
            file=sys.stderr,
        )
        raise SystemExit(2)


def main():
    args = set(sys.argv[1:])
    database_url = os.environ.get("DATABASE_URL", "postgres://app:app@localhost:5432/registry_platform")
    spec_root = os.environ.get("SPEC_ROOT", "spec")

    env = os.environ.copy()
    env["DATABASE_URL"] = database_url
    env["SPEC_ROOT"] = spec_root

    preflight()

    # (옵션) docker compose up -d
    if "--docker-up" in args or os.environ.get("DOCKER_UP") == "1":
        docker = shutil.which("docker")
        if not docker:
            print("WARN: docker가 없어 docker compose up은 건너뜁니다.", file=sys.stderr)
        else:
            run([docker, "compose", "-f", f"{spec_root}/13-implementation/docker-compose.dev.yml", "up", "-d"], env=env)

    # 1) 계약 검증
    run([sys.executable, f"{spec_root}/13-implementation/tools/validate_contracts.py"], env=env)

    # 2) 마이그레이션(가능하면 psql 사용)
    psql = shutil.which("psql")
    if not psql:
        print("WARN: psql이 없어 마이그레이션은 건너뜁니다. 가이드를 참고해 수동 적용하세요.", file=sys.stderr)
    else:
        run([psql, database_url, "-f", f"{spec_root}/13-implementation/migrations/0001_local_dev_core.sql"], env=env)
        run([psql, database_url, "-f", f"{spec_root}/13-implementation/migrations/0002_local_dev_case_money_rls.sql"], env=env)
        run([psql, database_url, "-f", f"{spec_root}/13-implementation/migrations/0003_local_dev_receivables.sql"], env=env)

    # 3) 시드
    run([sys.executable, f"{spec_root}/13-implementation/tools/seed_postgres.py"], env=env)

    # 4) 이벤트 적재
    run([sys.executable, f"{spec_root}/13-implementation/tools/load_domain_events.py"], env=env)

    # 5) 리플레이(스냅샷/원장)
    run([sys.executable, f"{spec_root}/13-implementation/tools/replay_case_snapshot.py"], env=env)

    # 6) 요약 출력(가능하면 psql)
    psql = shutil.which("psql")
    if psql:
        print("== summary (row counts) ==")
        sql = """
        \\pset footer off
        SELECT 'partners' AS table, count(*)::int AS rows FROM partners
        UNION ALL SELECT 'partner_profiles', count(*)::int FROM partner_profiles
        UNION ALL SELECT 'ad_campaigns', count(*)::int FROM ad_campaigns
        UNION ALL SELECT 'cases', count(*)::int FROM cases
        UNION ALL SELECT 'documents', count(*)::int FROM documents
        UNION ALL SELECT 'document_versions', count(*)::int FROM document_versions
        UNION ALL SELECT 'quotes', count(*)::int FROM quotes
        UNION ALL SELECT 'payments', count(*)::int FROM payments
        UNION ALL SELECT 'refunds', count(*)::int FROM refunds
        UNION ALL SELECT 'settlements_to_partner', count(*)::int FROM settlements_to_partner
        UNION ALL SELECT 'partner_receivables', count(*)::int FROM partner_receivables
        UNION ALL SELECT 'partner_receivable_offsets', count(*)::int FROM partner_receivable_offsets
        UNION ALL SELECT 'ledger_entries', count(*)::int FROM ledger_entries
        UNION ALL SELECT 'domain_events', count(*)::int FROM domain_events
        UNION ALL SELECT 'approval_requests', count(*)::int FROM approval_requests;
        """
        run([psql, database_url, "-v", "ON_ERROR_STOP=1", "-c", sql], env=env)
    else:
        print("WARN: psql이 없어 row count 요약은 생략합니다.", file=sys.stderr)

    print("ok: local demo complete")


if __name__ == "__main__":
    main()
