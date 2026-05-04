# Phase 12: 모바일 앱 확장 (Mobile App Expansion with React Native & Expo)

## 1. 개요
Phase 11까지 AgentRegi는 웹 기반의 End-to-End 플랫폼으로서 B2C, B2B, B2G를 아우르는 자동화 및 협업 기능을 완성했습니다.
Phase 12에서는 웹 환경을 넘어 **React Native와 Expo**를 활용하여 iOS 및 Android 네이티브 모바일 앱을 구축합니다. 모바일 앱은 사용자(B2C)에게는 보다 직관적이고 빠른 문서 제출과 알림을 제공하며, 파트너(B2B)에게는 이동 중에도 즉각적인 알림 수신 및 케이스 관리가 가능한 환경을 제공하여 전체적인 플랫폼 접근성과 사용자 경험을 극대화합니다.

## 2. 주요 목표
1. **React Native / Expo 기반 앱 뼈대 구축 (Mobile Foundation)**
   - 단일 코드베이스(Single Codebase)로 iOS와 Android 앱을 동시 개발.
   - Expo Router를 활용한 네비게이션 및 딥링크(Universal Links) 처리.
   - 모바일 환경에 최적화된 UI/UX 컴포넌트 시스템 구축.

2. **모바일 네이티브 기능 연동 (Native Features & UX)**
   - **문서 스캔:** 기기 카메라를 활용한 문서 촬영, 자동 크롭 및 화질 보정 후 업로드.
   - **푸시 알림:** APNs/FCM을 통한 실시간 기기 푸시 알림 수신 (상태 변경, 메시지 등).
   - **생체 인증:** Face ID / Touch ID를 활용한 빠른 로그인 및 중요 액션(결제, 서명) 승인.

3. **앱 배포 및 CI/CD 자동화 (App Distribution & CI/CD)**
   - **EAS Build:** 클라우드 환경에서 iOS/Android 앱 자동 빌드 파이프라인 구축.
   - **EAS Submit:** Apple App Store 및 Google Play Store 자동 배포.
   - **EAS Update:** 앱스토어 심사를 거치지 않는 긴급 버그 수정 및 OTA(Over-The-Air) 무선 업데이트.

## 3. 세부 마일스톤 (Milestones)

### 3.1 Milestone 12-1: Expo 프로젝트 초기화 및 기반 설정 (EP-29)
- Expo SDK 최신 버전으로 프로젝트 초기화 및 `app.json` 설정.
- Expo Router를 통한 파일 기반 라우팅 및 Auth 플로우(로그인/회원가입) 화면 구성.
- Firebase Native SDK(React Native Firebase) 연동 및 Apple/Google 소셜 네이티브 로그인 구현.
- 웹 기반 상태 관리(React Query 등) 및 API 클라이언트 모바일 마이그레이션.

### 3.2 Milestone 12-2: 모바일 네이티브 기능 구현 (EP-30)
- `expo-camera` 및 스캐너 라이브러리를 연동하여, 여권/신분증 및 종이 문서 스캔 기능 개발.
- `expo-notifications`를 이용해 기기 푸시 토큰 발급, 서버 등록, 포그라운드/백그라운드 알림 처리 로직 구현.
- 딥링크(Universal Links/App Links) 설정을 통해 알림 탭 시 특정 케이스나 문서 화면으로 바로 진입하도록 구성.
- `expo-local-authentication`을 연동하여 앱 잠금 해제 및 주요 인증 수단으로 생체 인식 도입.

### 3.3 Milestone 12-3: 앱 배포 파이프라인 구축 (EP-31)
- `eas.json` 프로필(개발, 프리뷰, 프로덕션) 구성.
- EAS Build를 통한 TestFlight 및 Google Play Internal Testing 빌드 배포.
- QA 완료 후 EAS Submit을 통한 스토어 정식 심사 제출.
- JS 번들 변경사항을 즉각 배포하기 위한 EAS Update 채널 구성 및 적용 테스트.

## 4. 기대 효과
이 페이즈가 완료되면 AgentRegi는 웹뿐만 아니라 모바일 생태계까지 커버하는 **진정한 옴니채널 플랫폼**으로 거듭납니다.
사용자는 스마트폰 카메라로 서류를 쉽게 스캔하고 푸시 알림으로 진행 상황을 즉각 안내받을 수 있어 이탈률이 감소합니다.
파트너 역시 모바일 앱을 통해 실시간으로 알림을 확인하고 빠른 대응이 가능해져, 결과적으로 전체적인 SLA(서비스 수준 협약) 지표와 고객 만족도(CSAT)가 크게 향상됩니다.
