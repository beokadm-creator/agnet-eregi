#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
계약 검증 도구(초안)

검증 범위:
1) JSON Schema 파일이 유효한 JSON인지
2) OpenAPI YAML이 파싱 가능한지
3) 샘플 이벤트 JSONL이 JSON 파싱 가능한지
4) (선택) 이벤트 JSONL이 case_event.schema.json에 validate 되는지

주의:
- 4)번을 하려면 jsonschema 설치 필요:
  pip install jsonschema --break-system-packages
"""

import json
import os
import sys


def read_json(path: str):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def validate_json_files(paths):
    for p in paths:
        read_json(p)
    print("ok: json files parse")


def validate_openapi_yaml(path: str):
    import yaml  # PyYAML (대부분 환경에 있음)

    with open(path, "r", encoding="utf-8") as f:
        yaml.safe_load(f)
    print("ok: openapi yaml parse")


def validate_jsonl_parse(path: str):
    with open(path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            json.loads(line)
    print(f"ok: jsonl parse ({i} lines)")


def validate_events_schema(schema_path: str, jsonl_path: str):
    try:
        from jsonschema import Draft202012Validator
    except Exception:
        print("jsonschema가 없어 이벤트 스키마 validate는 생략합니다.", file=sys.stderr)
        return

    schema = read_json(schema_path)
    validator = Draft202012Validator(schema)

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            obj = json.loads(line)
            errors = sorted(validator.iter_errors(obj), key=lambda e: e.path)
            if errors:
                print(f"fail: schema validate at line {i}", file=sys.stderr)
                for e in errors[:5]:
                    print(" -", e.message, file=sys.stderr)
                raise SystemExit(1)
    print("ok: events schema validate")


def validate_settlement_payloads(settlement_schema_path: str, jsonl_path: str):
    """
    settlement_event.schema.json은 'payload 계약'이므로,
    이벤트 JSONL에서 결제/환불/정산 계열 이벤트만 골라
    {version,eventType,data}로 변환해 validate 한다.
    """
    try:
        from jsonschema import Draft202012Validator
    except Exception:
        print("jsonschema가 없어 정산 페이로드 validate는 생략합니다.", file=sys.stderr)
        return

    settlement_schema = read_json(settlement_schema_path)
    validator = Draft202012Validator(settlement_schema)

    settlement_prefixes = (
        "PAYMENT_",
        "REFUND_",
        "SETTLEMENT_",
        "LEGAL_FEES_",
        "PARTNER_FEE_",
        "PLATFORM_FEE_",
        "PARTNER_RECEIVABLE_",
    )

    with open(jsonl_path, "r", encoding="utf-8") as f:
        for i, line in enumerate(f, 1):
            if not line.strip():
                continue
            obj = json.loads(line)
            et = obj.get("eventType", "")
            if not et.startswith(settlement_prefixes):
                continue
            payload = {"version": obj.get("version"), "eventType": et, "data": obj.get("data")}
            errors = sorted(validator.iter_errors(payload), key=lambda e: e.path)
            if errors:
                print(f"fail: settlement payload validate at line {i} ({et})", file=sys.stderr)
                for e in errors[:5]:
                    print(" -", e.message, file=sys.stderr)
                raise SystemExit(1)

    print("ok: settlement payload validate")


def main():
    root = os.environ.get("SPEC_ROOT", "spec")

    json_files = [
        f"{root}/02-engine/contracts/ui_cards.schema.json",
        f"{root}/02-engine/events/case_event.schema.json",
        f"{root}/02-engine/contracts/settlement_event.schema.json",
    ]
    openapi = f"{root}/02-engine/openapi_v1.yaml"
    jsonl_files = [
        f"{root}/13-implementation/seeds/case_events.sample.jsonl",
        f"{root}/13-implementation/seeds/derived_events.sample.jsonl",
    ]

    validate_json_files(json_files)
    validate_openapi_yaml(openapi)
    for p in jsonl_files:
        validate_jsonl_parse(p)
        validate_events_schema(f"{root}/02-engine/events/case_event.schema.json", p)
        validate_settlement_payloads(f"{root}/02-engine/contracts/settlement_event.schema.json", p)


if __name__ == "__main__":
    main()
