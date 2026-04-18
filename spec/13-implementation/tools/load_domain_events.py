#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
domain_events JSONL 로더(초안)

입력:
- spec/13-implementation/seeds/case_events.sample.jsonl

목표:
- 이벤트 스트림을 domain_events(append-only)에 적재
- 리플레이/타임라인 재현이 가능하게 함

주의:
- 실행 전: psycopg2 설치 필요
  pip install psycopg2-binary --break-system-packages
"""

import json
import os
import sys

try:
    import psycopg2
except Exception:
    print("psycopg2가 필요합니다. pip install psycopg2-binary --break-system-packages", file=sys.stderr)
    raise


def main():
    database_url = os.environ.get("DATABASE_URL", "postgres://app:app@localhost:5432/registry_platform")
    jsonl_path = os.environ.get("EVENTS_JSONL", "spec/13-implementation/seeds/case_events.sample.jsonl")

    conn = psycopg2.connect(database_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            with open(jsonl_path, "r", encoding="utf-8") as f:
                for line_no, line in enumerate(f, 1):
                    e = json.loads(line)
                    cur.execute(
                        """
                        INSERT INTO domain_events (
                          id, event_type, version, occurred_at,
                          producer_service, producer_version,
                          actor_type, actor_id,
                          session_id, case_id, partner_id,
                          trace_json, data_json
                        ) VALUES (
                          %s::uuid, %s, %s, %s::timestamptz,
                          %s, %s,
                          %s, %s,
                          %s, %s, %s,
                          %s::jsonb, %s::jsonb
                        )
                        ON CONFLICT (id) DO NOTHING
                        """,
                        (
                            e["eventId"],
                            e["eventType"],
                            e["version"],
                            e["occurredAt"],
                            e["producer"]["service"],
                            e["producer"]["version"],
                            e["actor"]["type"],
                            e["actor"].get("id"),
                            e.get("sessionId"),
                            e.get("caseId"),
                            e.get("partnerId"),
                            json.dumps(e.get("trace") or {}, ensure_ascii=False),
                            json.dumps(e.get("data") or {}, ensure_ascii=False),
                        ),
                    )

        conn.commit()
        print("ok: domain_events loaded from", jsonl_path)
    except Exception as ex:
        conn.rollback()
        print(f"fail at line: {line_no}", file=sys.stderr)
        raise ex
    finally:
        conn.close()


if __name__ == "__main__":
    main()

