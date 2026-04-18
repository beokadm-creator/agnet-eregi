# Firebase + React 구현 레포(스캐폴딩)

이 폴더는 `spec/13-implementation/*` 개발 기획을 바탕으로 **바로 개발을 시작하기 위한 스캐폴딩**입니다.

## 1) 설치
```bash
npm install
```

## 2) 로컬 개발(앱)
```bash
npm run dev:user
npm run dev:partner
npm run dev:ops
```

## 3) 에뮬레이터
```bash
npm run emulators
```

> Firestore Emulator는 Java가 필요합니다(권장: Java 17).

## 3-C) dev 권한 전환(에뮬레이터 전용)
로컬에서 role/partnerId를 빠르게 테스트하기 위해 아래 dev endpoint가 있습니다.
- `POST /v1/dev/set-claims` (Functions emulator에서만 동작)
> 운영 환경에서는 이 엔드포인트가 동작하지 않도록 코드에서 차단되어 있습니다.

## 3-B) Functions API 확인(MVP)
에뮬레이터에서 Functions가 뜨면:
- `GET http://127.0.0.1:5001/<projectId>/asia-northeast3/api/health`
- `POST http://127.0.0.1:5001/<projectId>/asia-northeast3/api/v1/cases` (Authorization 필요)

## 3-A) Rules 테스트
에뮬레이터 기반 스모크 테스트:
```bash
npm run test:rules:exec
```

## 6) CI (GitHub Actions)
- `.github/workflows/ci.yml`에서 빌드 + Rules 테스트(emulators:exec)를 실행합니다.

## 4) Functions
```bash
npm --workspace functions run build
```

## 5) Rules/Indexes
- `firestore.rules`, `storage.rules`, `firestore.indexes.json`을 기준으로 배포
