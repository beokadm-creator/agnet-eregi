# 배포 일원화 (Staging/Prod)

## 원칙

- 스테이징/프로덕션은 Firebase Project가 다르므로 “완전히 동일한 URL”은 불가능합니다.
- 대신, 배포 커맨드/설정 경로는 한 가지 방식으로 고정합니다.
- 직접 `firebase deploy --project ...`를 치지 말고 아래 npm 스크립트만 사용합니다.

## 프로젝트 매핑

`.firebaserc`에서 별칭으로 고정합니다.

- `project-staging` → `agentregi-d77a3`
- `project-prod` → `agent-eregi`

## 배포 커맨드 (유일한 진입점)

firebase-react 폴더에서 실행:

```bash
npm run deploy:staging
npm run deploy:prod
```

위 스크립트는 내부적으로 `npm run build`를 먼저 수행한 뒤 deploy를 진행합니다.

## Hosting URL

- Staging
  - user-web: https://agentregi-d77a3-user-web.web.app
  - partner-console: https://agentregi-d77a3-partner-console.web.app
  - ops-console: https://agentregi-d77a3-ops-console.web.app
- Prod
  - user-web: https://agentregi-user-web.web.app
  - partner-console: https://agentregi-partner-console.web.app
  - ops-console: https://agentregi-ops-console.web.app

## Ops 콘솔에서 환경 확인

Ops 콘솔 상단 바에 `STAGING/PROD` 뱃지와 현재 hostname을 표시합니다.
