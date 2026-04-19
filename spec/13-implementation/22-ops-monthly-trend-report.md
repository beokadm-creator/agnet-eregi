# 월간 트렌드 요약 (Ops Monthly Report)

## 1) 목적
일일 단위로 생성되는 `ops_daily_logs`의 구조화된 데이터(`metrics`, `topIssues`)를 기반으로 월간 누적 데이터를 자동 집계한다.
집계된 데이터는 `ops_monthly_reports`라는 별도 컬렉션(SSOT)에 저장하여, 장기적인 품질/장애 트렌드를 Ops Console에서 손쉽게 조회하고 분석할 수 있게 한다.

## 2) 데이터 모델 (`ops_monthly_reports`)
- **문서 ID**: `{gateKey}:{YYYY-MM}`
- **스키마 구조**:
```ts
{
  gateKey: string,
  month: "YYYY-MM",
  generatedAt: Timestamp,

  totals: {
    daysWithLogs: number,
    totalGate: number,
    ok: number,
    fail: number
  },

  topSlots: Array<{
    slotId: string,
    severity: number,
    impactCount: number,
    daysAppeared: number
  }>,

  daily: Array<{
    date: "YYYY-MM-DD",
    total: number,
    ok: number,
    fail: number,
    topMissing: string[]
  }>,

  markdownSummary: string
}
```
- 특징: 단순히 마크다운 텍스트를 파싱하는 것이 아니라, 일일 SSOT가 저장될 때 미리 만들어둔 구조화된 필드를 합산하므로 오류가 적고 빠르다.

## 3) 서버 API 설계 (`reports.ts`)
### A. 월간 리포트 생성 (`POST /v1/ops/reports/:gateKey/monthly/generate`)
- **권한**: `isOps` 전용
- **파라미터**: `month` (선택, 기본값 이번 달 KST), `dryRun` (선택)
- **로직**:
  1. `ops_daily_logs` 컬렉션에서 해당 게이트, 해당 월의 모든 문서를 조회 (`>= startId`, `< endId`).
  2. `metrics`를 합산하여 `totals`와 `daily` 배열을 만든다.
  3. `topIssues`를 순회하며 `slotId` 별로 `impactCount`를 누적하고, `daysAppeared`를 카운트한다. (심각도는 발생한 케이스 중 가장 높은(작은 숫자) Sev 유지).
  4. 간결한 포맷의 `markdownSummary`를 생성한다.
  5. `ops_monthly_reports`에 덮어쓰기(upsert)로 저장한다.

### B. 월간 리포트 조회 (`GET /v1/ops/reports/:gateKey/monthly?month=YYYY-MM`)
- **권한**: `isOps` 전용
- **로직**: `ops_monthly_reports`에서 단일 문서를 조회. 존재하지 않으면 `404 NOT_FOUND` 반환.

## 4) Ops Console UI 연동
- **위치**: "오늘 운영 요약" 섹션 상단의 `[월간 운영 보고]` 패널
- **조작**: 
  - 현재 입력된 `summaryDate`의 연/월(`YYYY-MM`)을 기준으로 동작한다.
  - `[월간 요약 조회]` 버튼: 기존에 생성된 월간 리포트가 있으면 즉시 렌더링.
  - `[월간 요약 생성/갱신]` 버튼: 집계 API를 호출하여 최신 상태로 갱신하고 화면에 표시.
- **화면 구성**:
  - 3개의 핵심 지표 카드: **가동 일수**, **총 Gate 처리**, **성공/실패**
  - **🔥 Top 누락 Slot**: 슬롯 ID, Sev, 누적 발생 건수(Impact), 등장 일수를 테이블 형태로 렌더링
  - **📝 마크다운 프리뷰**: 생성된 월간 요약 텍스트를 바로 복사할 수 있게 제공.

## 5) 운영 가이드
- 매일 `[월간 요약 생성/갱신]` 버튼을 눌러 누적된 트렌드를 실시간으로 파악할 수 있다. (멱등성이 보장되므로 여러 번 갱신해도 무방함).
- 이후 GitHub Actions 파이프라인이나 Cloud 스케줄러에 이 Generate API 호출을 편입시키면 수동 개입 없이도 매월 초/매일 자동으로 월간 보고서가 갱신된다.