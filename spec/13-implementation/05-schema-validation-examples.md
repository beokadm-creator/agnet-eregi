# 스키마 검증 예시(로컬) — v1

목표: 시드/샘플 payload가 계약(JSON Schema/OpenAPI)을 만족하는지 개발자가 빠르게 확인할 수 있게 한다.

---

## 1) 검증 대상(단일 소스)

- UI 카드 계약: `02-engine/contracts/ui_cards.schema.json`
- 이벤트 envelope 계약: `02-engine/events/case_event.schema.json`
- 정산 이벤트 계약: `02-engine/contracts/settlement_event.schema.json`
- OpenAPI: `02-engine/openapi_v1.yaml`

---

## 2) 시드 파일(예)

- 파트너 시드(10개): `13-implementation/seeds/partners.seed.json`
- 광고 캠페인 시드: `13-implementation/seeds/ads.seed.json`
- 케이스 이벤트 스트림(JSONL): `13-implementation/seeds/case_events.sample.jsonl`
- 파생 이벤트 스트림(JSONL): `13-implementation/seeds/derived_events.sample.jsonl` (미수금 생성/상계)

---

## 3) 이벤트 JSONL 검증(개념)

검증 기준:
- 각 라인은 `case_event.schema.json`의 oneOf 중 하나를 만족해야 함

권장 구현(예):
- Node: `ajv`(draft2020-12)로 schema 로드 → 라인별 validate
- 또는 Python: `jsonschema`로 validate

주의:
- 이벤트는 append-only이므로 “선형”으로 넣을 수 있는지(선행 이벤트 존재)까지는 별도 시나리오 테스트에서 검증

---

## 4) OpenAPI 검증(개념)

권장:
- CI에서 OpenAPI lint/validate 실행
- breaking change 금지(필드 제거/타입 변경 금지)

---

## 5) 최소 CI 체크리스트

- [ ] JSON Schema 파일 자체가 유효한 JSON
- [ ] OpenAPI YAML 파싱 가능
- [ ] 샘플 이벤트 JSONL 파싱 가능
- [ ] (권장) 샘플 이벤트가 스키마 validate 통과
