#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
로컬 개발용 시드 로더(초안)

목표:
- spec/13-implementation/seeds/*.json 을 Postgres에 적재
- 파트너/광고/이벤트 저장소를 최소 재현 가능하게 함

주의:
- 운영용이 아니라 로컬 재현용입니다.
- 실행 전: psycopg2 설치 필요
  pip install psycopg2-binary --break-system-packages
"""

import json
import os
import sys
from dataclasses import dataclass

try:
    import psycopg2
    import psycopg2.extras
except Exception as e:
    print("psycopg2가 필요합니다. pip install psycopg2-binary --break-system-packages", file=sys.stderr)
    raise


@dataclass
class Config:
    database_url: str
    partners_seed_path: str
    ads_seed_path: str


def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def upsert_partner(cur, partner_id: str, profile: dict):
    name_ko = profile["nameKo"]
    ptype = profile["type"]
    verification = profile["verification"]

    cur.execute(
        """
        INSERT INTO partners (external_id, name_ko, type, verification, status)
        VALUES (%s, %s, %s, %s, 'active')
        ON CONFLICT (external_id) DO UPDATE SET
          name_ko=EXCLUDED.name_ko,
          type=EXCLUDED.type,
          verification=EXCLUDED.verification,
          updated_at=now()
        RETURNING id
        """,
        (partner_id, name_ko, ptype, verification),
    )
    pid = cur.fetchone()[0]

    cur.execute(
        """
        INSERT INTO partner_profiles (partner_id, profile_json, address_ko, region_ko, lat, lng, visitable)
        VALUES (%s, %s::jsonb, %s, %s, %s, %s, %s)
        ON CONFLICT (partner_id) DO UPDATE SET
          profile_json=EXCLUDED.profile_json,
          address_ko=EXCLUDED.address_ko,
          region_ko=EXCLUDED.region_ko,
          lat=EXCLUDED.lat,
          lng=EXCLUDED.lng,
          visitable=EXCLUDED.visitable,
          updated_at=now()
        """,
        (
            pid,
            json.dumps(profile, ensure_ascii=False),
            (profile.get("location") or {}).get("addressKo"),
            (profile.get("serviceArea") or {}).get("regionsKo", [None])[0],
            (profile.get("location") or {}).get("lat"),
            (profile.get("location") or {}).get("lng"),
            (profile.get("visitable") or {}).get("supported", False),
        ),
    )

    # capabilities
    for cp in (profile.get("capabilities") or {}).get("casePackIds", []):
        cur.execute(
            """
            INSERT INTO partner_casepack_capabilities (partner_id, case_pack_id, enabled)
            VALUES (%s, %s, true)
            ON CONFLICT (partner_id, case_pack_id) DO UPDATE SET enabled=true
            """,
            (pid, cp),
        )

    return pid


def load_partners(conn, partners_seed_path: str):
    seed = read_json(partners_seed_path)
    partners = seed.get("partners", [])
    mapping = {}  # seed partnerId(text) -> db uuid

    with conn.cursor() as cur:
        for p in partners:
            seed_id = p["partnerId"]
            profile = p["profileJson"]
            db_id = upsert_partner(cur, seed_id, profile)
            mapping[seed_id] = str(db_id)

    return mapping


def load_ads(conn, ads_seed_path: str, partner_id_map: dict):
    seed = read_json(ads_seed_path)
    campaigns = seed.get("campaigns", [])

    with conn.cursor() as cur:
        for c in campaigns:
            partner_seed = c["partnerId"]
            if partner_seed not in partner_id_map:
                print(f"[WARN] 광고 캠페인 partnerId 미매핑: {partner_seed}")
                continue
            partner_uuid = partner_id_map[partner_seed]
            cur.execute(
                """
                INSERT INTO ad_campaigns (
                  id, partner_id, status, budget_amount, currency, starts_at, ends_at, placement_rules
                ) VALUES (%s, %s::uuid, %s, %s, %s, %s::timestamptz, %s::timestamptz, %s::jsonb)
                ON CONFLICT (id) DO UPDATE SET
                  status=EXCLUDED.status,
                  budget_amount=EXCLUDED.budget_amount,
                  ends_at=EXCLUDED.ends_at,
                  placement_rules=EXCLUDED.placement_rules,
                  updated_at=now()
                """,
                (
                    c["campaignId"],
                    partner_uuid,
                    c["status"],
                    c["budgetAmount"],
                    c.get("currency", "KRW"),
                    c["startsAt"],
                    c["endsAt"],
                    json.dumps(c.get("placementRules") or {}, ensure_ascii=False),
                ),
            )


def main():
    cfg = Config(
        database_url=os.environ.get("DATABASE_URL", "postgres://app:app@localhost:5432/registry_platform"),
        partners_seed_path=os.environ.get(
            "PARTNERS_SEED",
            "spec/13-implementation/seeds/partners.seed.json",
        ),
        ads_seed_path=os.environ.get(
            "ADS_SEED",
            "spec/13-implementation/seeds/ads.seed.json",
        ),
    )

    conn = psycopg2.connect(cfg.database_url)
    conn.autocommit = False

    try:
        partner_map = load_partners(conn, cfg.partners_seed_path)
        load_ads(conn, cfg.ads_seed_path, partner_map)
        conn.commit()
        print("ok: seeds loaded")
        print("partnerId map:", json.dumps(partner_map, ensure_ascii=False, indent=2))
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    main()
