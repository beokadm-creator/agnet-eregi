# 패킷 #23: 감사 로그(Audit Log) 뷰어 및 페이지네이션

## 1. 개요
운영 환경에서 발생하는 다양한 자동화 이벤트(`ops_audit_events`)를 조회하고 필터링할 수 있는 Audit Log Viewer를 Ops Console에 도입합니다. 커서 기반 페이지네이션과 세부 조건 필터링을 통해 대량의 로그를 안정적으로 조회할 수 있습니다.

## 2. API 명세

### 2.1. `GET /v1/ops/audit-events`
- **목적**: 통합 감사 이벤트 목록 조회 (최신순)
- **Query Params**:
  - `gateKey` (string): 특정 Gate 필터
  - `action` (string): 특정 Action 필터
  - `status` (string): `success` 또는 `fail`
  - `actorUid` (string): 특정 실행자 필터
  - `from` / `to` (string): ISO 날짜 포맷 (기본값: 최근 7일)
  - `cursor` (string): 커서 기반 페이지네이션 (JSON stringified `[createdAtMillis, docId]`)
  - `limit` (number): 조회 건수 (기본 50, 최대 200 강제)
- **응답**:
  ```json
  {
    "ok": true,
    "data": {
      "items": [ ... ],
      "nextCursor": "[1712345678901, \"doc-id\"]"
    }
  }
  ```
- **인덱스 요구사항**:
  - `gateKey` (ASC), `createdAt` (DESC)
  - `action` (ASC), `createdAt` (DESC)
  - `status` (ASC), `createdAt` (DESC)
  - `actorUid` (ASC), `createdAt` (DESC)
- **제약 사항 (복합 인덱스 폭증 방지)**:
  - 현재는 각 필터 필드(gateKey, action, status, actorUid)를 독립적으로 `createdAt`과 결합하여 단일 조건 필터링을 최적화하도록 설계되었습니다.
  - 여러 필터를 동시에 적용할 경우, 설정된 복합 인덱스가 없으면 Firestore에서 인덱스 에러가 발생할 수 있습니다. 운영상 자주 쓰이는 조합(예: `gateKey` + `status` + `createdAt`)에 대해서만 인덱스를 추가로 생성하고, 무분별한 다중 조건 조합은 제한하는 것이 좋습니다.

### 2.2. `GET /v1/ops/audit-events/:id`
- **목적**: 단건 상세 조회
- **응답**: `{ ok: true, data: { item: { ... } } }`

## 3. UI (Ops Console)
- **리스트 및 필터**: 기간, GateKey, Action, Status, Actor UID를 필터링할 수 있는 UI 제공.
- **페이지네이션**: `nextCursor` 기반 "더 보기 (Next)" 버튼 제공.
- **상세 모달**: 특정 이벤트를 클릭하면 모달 창이 열리며, 상세 정보와 `target/meta` JSON Pretty View 및 복사 버튼을 제공합니다.
