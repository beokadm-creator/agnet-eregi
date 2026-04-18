#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
이벤트 리플레이(스냅샷 재구성) 스캐폴딩 — v1

목표:
- domain_events(append-only)를 읽어 로컬 스냅샷 테이블(cases/documents/quotes/payments 등)을 재구성
- 운영 복구/디버깅/테스트에 활용

범위(초안):
- CASE_CREATED/ACCEPTED/COMPLETED/CANCELLED
- DOCUMENT_UPLOADED
- QUOTE_FINALIZED/QUOTE_ACCEPTED
- PAYMENT_AUTHORIZED/PAYMENT_CAPTURED
- SETTLEMENT_TO_PARTNER_CREATED/PAID

주의:
- 현재 domain_events에는 envelope 전체가 아니라 data_json만 저장(로컬 최소 스키마).
  운영 구현에서는 envelope 원문 저장 또는 event_id로 원문 참조가 권장됩니다.
"""

import json
import os
import sys
import uuid
from typing import Any, Dict, Optional

try:
    import psycopg2
except Exception:
    print("psycopg2가 필요합니다. pip install psycopg2-binary --break-system-packages", file=sys.stderr)
    raise


def jget(obj: Dict[str, Any], key: str, default=None):
    v = obj.get(key, default)
    return v


def upsert_case(cur, case_id: str, partner_id: Optional[str], session_id: Optional[str], case_pack_id: Optional[str], status: str):
    cur.execute(
        """
        INSERT INTO cases (id, partner_id, session_id, case_pack_id, status, risk_level)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, 'low')
        ON CONFLICT (id) DO UPDATE SET
          partner_id = COALESCE(EXCLUDED.partner_id, cases.partner_id),
          session_id = COALESCE(EXCLUDED.session_id, cases.session_id),
          case_pack_id = COALESCE(EXCLUDED.case_pack_id, cases.case_pack_id),
          status = EXCLUDED.status,
          updated_at = now()
        """,
        (case_id, partner_id, session_id, case_pack_id or "unknown", status),
    )


def ensure_document(cur, document_id: str, case_id: str, slot_id: Optional[str], status: str):
    cur.execute(
        """
        INSERT INTO documents (id, case_id, slot_id, status)
        VALUES (%s::uuid, %s::uuid, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          slot_id = COALESCE(EXCLUDED.slot_id, documents.slot_id),
          status = EXCLUDED.status,
          updated_at = now()
        """,
        (document_id, case_id, slot_id, status),
    )


def insert_document_version(cur, version_id: str, document_id: str, file_name: str, mime_type: str, size_bytes: int, sha256: Optional[str], storage_ref: str):
    cur.execute(
        """
        INSERT INTO document_versions (
          id, document_id, file_name, mime_type, size_bytes, sha256, storage_ref,
          created_by_actor_type, created_by_actor_id
        ) VALUES (
          %s::uuid, %s::uuid, %s, %s, %s, %s, %s,
          'system', 'replayer'
        )
        ON CONFLICT (id) DO NOTHING
        """,
        (version_id, document_id, file_name, mime_type, size_bytes, sha256, storage_ref),
    )

def ensure_review_request(cur, rr_id: str, case_id: str, actor_type: str = "system", actor_id: str = "replayer"):
    cur.execute(
        """
        INSERT INTO review_requests (id, case_id, status, requested_by_actor_type, requested_by_actor_id)
        VALUES (%s::uuid, %s::uuid, 'requested', %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          updated_at=now()
        """,
        (rr_id, case_id, actor_type, actor_id),
    )


def insert_review_decision(cur, rr_id: str, decision: str, issues: Any, actor_type: str = "system", actor_id: str = "replayer"):
    cur.execute(
        """
        INSERT INTO review_decisions (
          review_request_id, decision, issues_json, decided_by_actor_type, decided_by_actor_id
        ) VALUES (
          %s::uuid, %s, %s::jsonb, %s, %s
        )
        """,
        (rr_id, decision, json.dumps(issues or [], ensure_ascii=False), actor_type, actor_id),
    )


def upsert_quote_finalized(cur, quote_id: str, case_id: str, partner_id: Optional[str], data: Dict[str, Any]):
    price_range = data.get("priceRange") or {}
    eta_range = data.get("etaRange") or {}
    cur.execute(
        """
        INSERT INTO quotes (
          id, case_id, partner_id,
          price_min, price_max, currency,
          eta_min_hours, eta_max_hours,
          assumptions_json, status
        ) VALUES (
          %s::uuid, %s::uuid, %s::uuid,
          %s, %s, %s,
          %s, %s,
          %s::jsonb, 'finalized'
        )
        ON CONFLICT (id) DO UPDATE SET
          price_min=EXCLUDED.price_min,
          price_max=EXCLUDED.price_max,
          currency=EXCLUDED.currency,
          eta_min_hours=EXCLUDED.eta_min_hours,
          eta_max_hours=EXCLUDED.eta_max_hours,
          assumptions_json=EXCLUDED.assumptions_json,
          status='finalized',
          updated_at=now()
        """,
        (
            quote_id,
            case_id,
            partner_id,
            price_range.get("min", 0),
            price_range.get("max", 0),
            price_range.get("currency", "KRW"),
            eta_range.get("minHours", 0),
            eta_range.get("maxHours", 0),
            json.dumps(data.get("assumptionsKo") or [], ensure_ascii=False),
        ),
    )


def insert_payment(cur, payment_id: str, case_id: str, quote_id: Optional[str], data: Dict[str, Any], status: str):
    amt = (data.get("amount") or {}).get("amount", 0)
    cur.execute(
        """
        INSERT INTO payments (id, case_id, quote_id, amount, currency, method, pg, pg_auth_key, status)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          status=EXCLUDED.status,
          updated_at=now()
        """,
        (
            payment_id,
            case_id,
            quote_id,
            amt,
            (data.get("amount") or {}).get("currency", "KRW"),
            data.get("method", "card"),
            data.get("pg", "pg"),
            data.get("pgAuthKey"),
            status,
        ),
    )

def upsert_settlement_created(cur, settlement_id: str, partner_uuid: str, case_id: str, data: Dict[str, Any]):
    gross = (data.get("grossAmount") or {}).get("amount", 0)
    platform_fee = (data.get("platformFee") or {}).get("amount", 0)
    net = (data.get("netAmount") or {}).get("amount", 0)
    currency = (data.get("grossAmount") or {}).get("currency", "KRW")
    cur.execute(
        """
        INSERT INTO settlements_to_partner (
          id, partner_id, case_id, gross_amount, platform_fee, net_amount, currency, status, created_at
        ) VALUES (
          %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, 'created', now()
        )
        ON CONFLICT (id) DO UPDATE SET
          gross_amount=EXCLUDED.gross_amount,
          platform_fee=EXCLUDED.platform_fee,
          net_amount=EXCLUDED.net_amount,
          currency=EXCLUDED.currency,
          status='created'
        """,
        (settlement_id, partner_uuid, case_id, gross, platform_fee, net, currency),
    )


def mark_settlement_paid(cur, settlement_id: str, paid_at: str, bank_ref: Optional[str]):
    cur.execute(
        """
        UPDATE settlements_to_partner
        SET status='paid', paid_at=%s::timestamptz, bank_ref=%s
        WHERE id=%s::uuid
        """,
        (paid_at, bank_ref, settlement_id),
    )

def apply_receivable_offsets(
    cur,
    occurred_at: str,
    case_id: str,
    partner_uuid: str,
    partner_external_id: str,
    settlement_id: str,
    event_id: str,
    max_offset_ratio: float = 0.5,
    session_external_id: Optional[str] = None,
):
    """
    미수금(open)을 정산 지급액(net_amount)에서 상계(Offset)한다.

    로컬 최소 규칙:
    - offsetBudget = net_amount * max_offset_ratio
    - FIFO(created_at ASC)
    - 적용 시:
      - settlements_to_partner.net_amount 감소
      - partner_receivable_offsets 기록
      - partner_receivables.amount(잔액) 감소 (로컬 단순화)
      - 원장 분개: Dr L_PARTNER_PAYABLE / Cr A_PARTNER_RECEIVABLE
    """
    cur.execute(
        "SELECT net_amount, status FROM settlements_to_partner WHERE id=%s::uuid",
        (settlement_id,),
    )
    row = cur.fetchone()
    if not row:
        return
    net_amount, st_status = row
    if st_status != "created":
        # paid 이후 상계는 차기 배치에서 처리
        return

    net = float(net_amount or 0)
    if net <= 0:
        return
    offset_budget = max(0.0, net * max_offset_ratio)
    if offset_budget <= 0:
        return

    cur.execute(
        """
        SELECT id, amount
        FROM partner_receivables
        WHERE partner_id=%s::uuid AND status='open' AND amount > 0
        ORDER BY created_at ASC
        """,
        (partner_uuid,),
    )
    receivables = cur.fetchall()
    if not receivables:
        return

    total_applied = 0.0
    for rid, amount in receivables:
        if offset_budget <= 0:
            break
        remaining = float(amount or 0)
        if remaining <= 0:
            continue
        applied = min(remaining, offset_budget)
        remaining_after = remaining - applied

        # offsets 기록
        cur.execute(
            """
            INSERT INTO partner_receivable_offsets (receivable_id, settlement_id, amount, currency)
            VALUES (%s::uuid, %s::uuid, %s, 'KRW')
            """,
            (str(rid), settlement_id, applied),
        )

        # 파생 이벤트(정산 엔진 산출물) 기록: PARTNER_RECEIVABLE_OFFSET_APPLIED
        derived_id = str(uuid.uuid4())
        cur.execute(
            """
            INSERT INTO domain_events (
              id, event_type, version, occurred_at,
              producer_service, producer_version,
              actor_type, actor_id,
              session_id, case_id, partner_id,
              trace_json, data_json
            ) VALUES (
              %s::uuid, %s, 'v1', %s::timestamptz,
              'settlement_service', 'v1',
              'system', 'replayer',
              %s, %s, %s,
              '{}'::jsonb,
              %s::jsonb
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (
                derived_id,
                "PARTNER_RECEIVABLE_OFFSET_APPLIED",
                occurred_at,
                session_external_id,
                case_id,
                partner_external_id,
                json.dumps(
                    {
                        "partnerId": partner_external_id,
                        "receivableId": str(rid),
                        "settlementId": settlement_id,
                        "amount": {"amount": applied, "currency": "KRW"},
                        "appliedAt": occurred_at,
                    },
                    ensure_ascii=False,
                ),
            ),
        )

        # receivable 잔액 업데이트(로컬 단순화: amount=잔액)
        new_status = "offset_applied" if remaining_after <= 0 else "open"
        cur.execute(
            """
            UPDATE partner_receivables
            SET amount=%s, status=%s, updated_at=now()
            WHERE id=%s::uuid
            """,
            (max(0.0, remaining_after), new_status, str(rid)),
        )

        offset_budget -= applied
        total_applied += applied

    if total_applied > 0:
        # settlement 지급액 감소
        cur.execute(
            """
            UPDATE settlements_to_partner
            SET net_amount = GREATEST(0, net_amount - %s)
            WHERE id=%s::uuid
            """,
            (total_applied, settlement_id),
        )
        # 원장: 지급채무 감소 / 미수금 감소
        insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "L_PARTNER_PAYABLE", total_applied, 0, "미수금 상계(지급채무 감소)")
        insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_PARTNER_RECEIVABLE", 0, total_applied, "미수금 상계(미수금 감소)")


def insert_ledger(cur, occurred_at: str, case_id: str, partner_uuid: Optional[str], event_id: Optional[str], account_code: str, dr: float, cr: float, memo: str):
    cur.execute(
        """
        INSERT INTO ledger_entries (
          occurred_at, case_id, partner_id, event_id, account_code, dr_amount, cr_amount, currency, memo_ko
        ) VALUES (
          %s::timestamptz, %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, 'KRW', %s
        )
        """,
        (occurred_at, case_id, partner_uuid, event_id, account_code, dr, cr, memo),
    )

def upsert_refund(cur, refund_id: str, payment_id: str, case_id: str, amount: float, currency: str, reason_ko: str, status: str):
    cur.execute(
        """
        INSERT INTO refunds (id, payment_id, case_id, amount, currency, reason_ko, status)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s)
        ON CONFLICT (id) DO UPDATE SET
          status=EXCLUDED.status,
          amount=EXCLUDED.amount,
          currency=EXCLUDED.currency,
          reason_ko=EXCLUDED.reason_ko,
          updated_at=now()
        """,
        (refund_id, payment_id, case_id, amount, currency, reason_ko, status),
    )

def apply_refund_to_settlement_and_ledger(cur, occurred_at: str, case_id: str, partner_uuid: Optional[str], event_id: str, refund_amount: float):
    """
    환불이 정산/원장에 미치는 영향을 '최소 규칙'으로 반영.

    규칙(단순/초안):
    - 환불은 플랫폼 수수료(platform_fee)부터 차감
    - 플랫폼 수수료를 초과한 환불은 파트너 지급분(net_amount)에서 차감
    - 정산이 이미 paid이면, 파트너 몫 환불은 '파트너 미수금(A_PARTNER_RECEIVABLE)'로 잡는다(추후 회수/차감).
    """
    cur.execute(
        """
        SELECT id, status, gross_amount, platform_fee, net_amount
        FROM settlements_to_partner
        WHERE case_id=%s::uuid
        ORDER BY created_at DESC
        LIMIT 1
        """,
        (case_id,),
    )
    row = cur.fetchone()
    if not row:
        # 정산 이벤트가 없으면, 원장에만 '플랫폼 환불'로 남긴다(최소)
        if partner_uuid:
            insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "R_PLATFORM_FEE", refund_amount, 0, "환불(정산 없음, 임시)")
            insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_CASH_PG", 0, refund_amount, "환불 출금(정산 없음, 임시)")
        return

    settlement_id, st_status, gross, pf, net = row
    pf_refund = min(refund_amount, float(pf))
    partner_refund = max(0.0, refund_amount - float(pf))

    # 정산 수치 조정(정산이 아직 created일 때만 직접 수정; paid면 회수/차감으로 처리)
    if st_status == "created":
        cur.execute(
            """
            UPDATE settlements_to_partner
            SET
              gross_amount = GREATEST(0, gross_amount - %s),
              platform_fee = GREATEST(0, platform_fee - %s),
              net_amount = GREATEST(0, net_amount - %s)
            WHERE id=%s::uuid
            """,
            (refund_amount, pf_refund, partner_refund, str(settlement_id)),
        )

    # 미수금 레코드 생성(지급 완료 후 파트너 몫 환불)
    if partner_uuid and partner_refund > 0 and st_status == "paid":
        # partner external id 조회
        cur.execute("SELECT external_id FROM partners WHERE id=%s::uuid", (partner_uuid,))
        r = cur.fetchone()
        partner_external_id = r[0] if r else None

        cur.execute(
            """
            INSERT INTO partner_receivables (partner_id, case_id, amount, currency, status, reason_ko, source_event_id)
            VALUES (%s::uuid, %s::uuid, %s, 'KRW', 'open', %s, %s::uuid)
            RETURNING id
            """,
            (partner_uuid, case_id, partner_refund, "정산 지급 후 환불로 인한 파트너 회수", event_id),
        )
        receivable_id = cur.fetchone()[0]

        # 파생 이벤트 기록: PARTNER_RECEIVABLE_CREATED
        if partner_external_id:
            derived_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO domain_events (
                  id, event_type, version, occurred_at,
                  producer_service, producer_version,
                  actor_type, actor_id,
                  session_id, case_id, partner_id,
                  trace_json, data_json
                ) VALUES (
                  %s::uuid, %s, 'v1', %s::timestamptz,
                  'settlement_service', 'v1',
                  'system', 'replayer',
                  NULL, %s, %s,
                  '{}'::jsonb,
                  %s::jsonb
                )
                ON CONFLICT (id) DO NOTHING
                """,
                (
                    derived_id,
                    "PARTNER_RECEIVABLE_CREATED",
                    occurred_at,
                    case_id,
                    partner_external_id,
                    json.dumps(
                        {
                            "partnerId": partner_external_id,
                            "caseId": case_id,
                            "amount": {"amount": partner_refund, "currency": "KRW"},
                            "reasonKo": "정산 지급 후 환불로 인한 파트너 회수",
                            "sourceEventId": event_id,
                            "createdAt": occurred_at,
                            "receivableId": str(receivable_id),
                        },
                        ensure_ascii=False,
                    ),
                ),
            )

    # 원장 분개(최소)
    if partner_uuid:
        if pf_refund > 0:
            insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "R_PLATFORM_FEE", pf_refund, 0, "환불(플랫폼 매출 감소)")
            insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_CASH_PG", 0, pf_refund, "환불 출금(플랫폼 몫)")

        if partner_refund > 0:
            if st_status == "paid":
                # 이미 지급된 파트너 몫은 회수 대상(미수금)
                insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_PARTNER_RECEIVABLE", partner_refund, 0, "환불(파트너 회수 미수금)")
                insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_CASH_PG", 0, partner_refund, "환불 출금(파트너 몫)")
            else:
                # 미지급이면 지급채무 감소로 정리
                insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "L_PARTNER_PAYABLE", partner_refund, 0, "환불(파트너 지급채무 감소)")
                insert_ledger(cur, occurred_at, case_id, partner_uuid, event_id, "A_CASH_PG", 0, partner_refund, "환불 출금(파트너 몫)")


def replay_case(database_url: str, case_id: str):
    conn = psycopg2.connect(database_url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            # ops 스코프로 리플레이(전체 접근)
            cur.execute("SELECT set_config('app.actor_type','ops', true)")

            cur.execute(
                """
                SELECT id, event_type, occurred_at, session_id, case_id, partner_id, data_json
                FROM domain_events
                WHERE case_id = %s
                ORDER BY occurred_at ASC
                """,
                (case_id,),
            )
            rows = cur.fetchall()
            if not rows:
                print("no events for case:", case_id)
                return

            for event_id, event_type, occurred_at, session_id, c_id, partner_id, data_json in rows:
                data = data_json or {}
                # partnerId는 이벤트에 external id(p_demo_01)로 들어올 수 있으므로,
                # 로컬에서는 partners.external_id로 partners.id(uuid)를 역참조한다.
                partner_uuid = None
                if partner_id:
                    cur.execute("SELECT id FROM partners WHERE external_id=%s", (partner_id,))
                    r = cur.fetchone()
                    if r:
                        partner_uuid = str(r[0])

                # sessionId도 외부 문자열이므로 sessions.external_id로 매핑(없으면 생성)
                session_uuid = None
                if session_id:
                    cur.execute(
                        """
                        INSERT INTO sessions (external_id) VALUES (%s)
                        ON CONFLICT (external_id) DO UPDATE SET last_seen_at=now()
                        RETURNING id
                        """,
                        (session_id,),
                    )
                    session_uuid = str(cur.fetchone()[0])

                if event_type == "CASE_CREATED":
                    upsert_case(cur, c_id, partner_uuid, session_uuid, data.get("casePackId"), "new")
                elif event_type == "CASE_ACCEPTED":
                    upsert_case(cur, c_id, partner_uuid, session_uuid, None, "in_progress")
                elif event_type == "CASE_COMPLETED":
                    upsert_case(cur, c_id, partner_uuid, session_uuid, None, "completed")
                elif event_type == "CASE_CANCELLED":
                    upsert_case(cur, c_id, partner_uuid, session_uuid, None, "cancelled")

                elif event_type == "DOCUMENT_UPLOADED":
                    doc_id = data.get("documentId")
                    ver_id = data.get("versionId")
                    slot_id = data.get("slotId")
                    ensure_document(cur, doc_id, c_id, slot_id, "검토중")
                    insert_document_version(
                        cur,
                        ver_id,
                        doc_id,
                        data.get("fileName", "file"),
                        data.get("mimeType", "application/octet-stream"),
                        int(data.get("sizeBytes", 0)),
                        data.get("sha256"),
                        data.get("storageRef", "local://"),
                    )

                elif event_type == "DOCUMENT_REVIEW_REQUESTED":
                    rr_id = data.get("reviewRequestId")
                    if rr_id:
                        ensure_review_request(cur, rr_id, c_id, "partner", "replayer_partner")
                    for doc_id in data.get("documentIds") or []:
                        # 검토 요청되면 문서 상태는 검토중
                        ensure_document(cur, doc_id, c_id, None, "검토중")

                elif event_type == "DOCUMENT_REVIEWED":
                    rr_id = data.get("reviewRequestId")
                    decision = data.get("decision")
                    if rr_id and decision:
                        insert_review_decision(cur, rr_id, decision, data.get("issues"))
                    # decision에 따라 문서/케이스 상태 업데이트(단순 규칙)
                    if decision == "OK":
                        for issue in data.get("issues") or []:
                            pass
                        # 문서ID가 없어서, reviewRequest에서 문서 목록을 찾는다(가능하면)
                        if rr_id:
                            cur.execute(
                                """
                                SELECT d.id
                                FROM documents d
                                WHERE d.case_id=%s::uuid AND d.status='검토중'
                                """,
                                (c_id,),
                            )
                            for (doc_id,) in cur.fetchall():
                                cur.execute("UPDATE documents SET status='OK', updated_at=now() WHERE id=%s", (doc_id,))
                    elif decision == "보완필요":
                        cur.execute("UPDATE cases SET status='waiting_user', updated_at=now() WHERE id=%s::uuid", (c_id,))
                        # 문서들을 보완필요로 표시
                        cur.execute(
                            "UPDATE documents SET status='보완필요', updated_at=now() WHERE case_id=%s::uuid",
                            (c_id,),
                        )

                elif event_type == "FIX_REQUEST_SENT":
                    cur.execute("UPDATE cases SET status='waiting_user', updated_at=now() WHERE id=%s::uuid", (c_id,))

                elif event_type == "FIX_SUBMITTED":
                    cur.execute("UPDATE cases SET status='waiting_partner', updated_at=now() WHERE id=%s::uuid", (c_id,))
                    # 보완 제출과 연결된 문서는 다시 검토중
                    doc_ids = data.get("documentIds") or []
                    if doc_ids:
                        cur.execute(
                            "UPDATE documents SET status='검토중', updated_at=now() WHERE id = ANY(%s::uuid[])",
                            (doc_ids,),
                        )

                elif event_type == "QUOTE_FINALIZED":
                    quote_id = data.get("quoteId")
                    upsert_quote_finalized(cur, quote_id, c_id, partner_uuid, data)
                elif event_type == "QUOTE_ACCEPTED":
                    quote_id = data.get("quoteId")
                    cur.execute(
                        "UPDATE quotes SET status='accepted', updated_at=now() WHERE id=%s::uuid",
                        (quote_id,),
                    )

                elif event_type == "PAYMENT_AUTHORIZED":
                    insert_payment(cur, data.get("paymentId"), c_id, data.get("quoteId"), data, "authorized")
                elif event_type == "PAYMENT_CAPTURED":
                    # captured은 기존 payment가 있어야 함(없으면 생성)
                    insert_payment(cur, data.get("paymentId"), c_id, None, data, "captured")

                elif event_type == "SETTLEMENT_TO_PARTNER_CREATED":
                    st_id = data.get("settlementId")
                    # settlements_to_partner 스냅샷
                    if partner_uuid and st_id:
                        upsert_settlement_created(cur, st_id, partner_uuid, c_id, data)
                        # 최소 원장 분개(예시): Dr 현금(PG) / Cr 플랫폼매출, 파트너지급채무
                        gross = (data.get("grossAmount") or {}).get("amount", 0)
                        pf = (data.get("platformFee") or {}).get("amount", 0)
                        net = (data.get("netAmount") or {}).get("amount", 0)
                        insert_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), "A_CASH_PG", gross, 0, "결제 수납(정산 기준)")
                        insert_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), "R_PLATFORM_FEE", 0, pf, "플랫폼 이용료 매출")
                        insert_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), "L_PARTNER_PAYABLE", 0, net, "파트너 지급채무")
                        # 미수금 상계 적용(있다면)
                        apply_receivable_offsets(
                            cur,
                            occurred_at,
                            c_id,
                            partner_uuid,
                            partner_id,
                            st_id,
                            str(event_id),
                            max_offset_ratio=0.5,
                            session_external_id=session_id,
                        )

                elif event_type == "SETTLEMENT_TO_PARTNER_PAID":
                    st_id = data.get("settlementId")
                    if st_id:
                        mark_settlement_paid(cur, st_id, data.get("paidAt"), data.get("bankRef"))
                    # 지급 원장 분개(예시): Dr 지급채무 / Cr 현금
                    net = (data.get("netAmount") or {}).get("amount", 0)
                    if partner_uuid:
                        insert_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), "L_PARTNER_PAYABLE", net, 0, "파트너 지급(채무 감소)")
                        insert_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), "A_CASH_PG", 0, net, "파트너 지급(현금 감소)")

                elif event_type == "REFUND_REQUESTED":
                    refund_id = data.get("refundId")
                    payment_id = data.get("paymentId")
                    amt = (data.get("amount") or {}).get("amount", 0)
                    curcy = (data.get("amount") or {}).get("currency", "KRW")
                    if refund_id and payment_id:
                        upsert_refund(cur, refund_id, payment_id, c_id, amt, curcy, data.get("reasonKo", ""), "requested")

                elif event_type == "REFUND_APPROVED":
                    refund_id = data.get("refundId")
                    if refund_id:
                        cur.execute("UPDATE refunds SET status='approved', updated_at=now() WHERE id=%s::uuid", (refund_id,))

                elif event_type == "REFUND_EXECUTED":
                    refund_id = data.get("refundId")
                    payment_id = data.get("paymentId")
                    amt = (data.get("amount") or {}).get("amount", 0)
                    curcy = (data.get("amount") or {}).get("currency", "KRW")
                    if refund_id and payment_id:
                        upsert_refund(cur, refund_id, payment_id, c_id, amt, curcy, "refund executed", "executed")
                    apply_refund_to_settlement_and_ledger(cur, occurred_at, c_id, partner_uuid, str(event_id), float(amt))

            conn.commit()
            print("ok: replayed case into snapshot tables:", case_id)
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def main():
    database_url = os.environ.get("DATABASE_URL", "postgres://app:app@localhost:5432/registry_platform")
    case_id = os.environ.get("CASE_ID", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeee0001")
    replay_case(database_url, case_id)


if __name__ == "__main__":
    main()
