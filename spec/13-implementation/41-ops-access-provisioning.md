# Ops Access Provisioning (권한 관리 및 Break-glass)

## 1. 개요
운영 환경(`opsRole`) 권한 부여 및 회수를 자동화하고, 투명한 감사를 위해 Ops Console 내 UI를 통해 실행되도록 강제합니다.
또한, 심야 장애 대응 등 긴급 상황에서 필요한 권한(`ops_admin`)을 즉각 확보할 수 있는 Break-glass(임시 권한 부여) 기능을 제공합니다.

## 2. 권한 종류
- `ops_viewer`: 조회 전용 권한
- `ops_operator`: Alert 재시도, 수동 알림 발송 등 제한적 쓰기 권한
- `ops_admin`: 설정 변경, 삭제(Retention), 권한 관리(Access) 등 전체 제어 권한

## 3. 권한 부여/회수 (Grant & Revoke)
- **API**: `POST /v1/ops/access/grant`, `POST /v1/ops/access/revoke`
- **수행자**: `ops_admin`
- **대상**: Firebase Authentication UID
- **로직**:
  - `adminApp.auth().setCustomUserClaims`를 통해 `opsRole` 클레임을 주입 또는 삭제.
  - 모든 행위는 `ops_audit_events`에 기록되며, 사유(reason) 필드가 필수로 요구됨.

## 4. 긴급 권한 부여 (Break-glass)
- **API**: `POST /v1/ops/access/breakglass`
- **수행자**: `ops_operator` 이상
- **로직**:
  - 사용자 본인에게 즉시 `ops_admin` 권한을 부여.
  - `breakGlassExpiresAt` 클레임에 30분 뒤의 Timestamp를 기록.
- **자동 회수 (Worker)**:
  - `opsAccessWorker`가 매 5분마다 모든 Ops 사용자의 클레임을 검사.
  - `breakGlassExpiresAt` 시간이 지났다면 `opsRole`을 원래대로 강등(또는 삭제)하고 회수 사실을 Audit 로깅.
- **주의사항**:
  - Break-glass 실행 후 브라우저(또는 클라이언트)는 토큰(ID Token)을 즉시 갱신(Refresh)해야 권한이 적용됩니다.

## 5. UI 및 운영 가이드
- Ops Console의 **[Access Management]** 섹션을 통해 권한 현황을 한눈에 조회하고 부여/회수/긴급권한 기능을 사용할 수 있습니다.
