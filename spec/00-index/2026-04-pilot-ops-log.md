# 파일럿 일일 운영 로그

목적: 파일럿 중 품질/흐름/저장/오류/처리시간을 매일 1회 고정 포맷으로 기록하고, Top3 이슈를 누적하여 에스컬레이션/백로그로 연결한다.

<!-- OPS_LOG_AUTO:START -->

---

## 일일 로그(복붙용)

### 날짜
- 날짜: 2026-04-18
- 작성자: Agent

### (품질) /packages/validate
- Gate 집계 결과:
  [2026-04-18 Gate 집계] 총 3건 (성공: 1건, 실패: 2건)
  - 주요 누락서류: slot_registration_application_signed(2건), slot_minutes_signed(2건), slot_power_of_attorney_signed(2건)
  - 실패 샘플(최대3건): case_fail_4a2002a0-6c73-4dc5-8d18-b714259eb7c4, case_fail_a7bc2848-418e-4861-949a-30c6213fc85e

### (흐름) stage 자동전진/자동완료
- 자동전진/자동완료 실패 건수:
  - draft_filing → filing_submitted: -건
  - filing_submitted → completed: -건
- 수동 처리 건수(재시도/수동업로드 등): -건
- 대표 caseId: -

### (저장/패키지) bucket.exists / ZIP / meta.json
- bucket.exists 실패/지연: -건
- zip 누락/다운로드 실패: -건
- meta.json validation 기록 누락: -건
- 대표 caseId: -

### (오류) API / 콘솔 / 서버
- API 5xx Top3(코드/메시지/건수):
  - -
  - -
  - -
- API 4xx Top3(코드/메시지/건수):
  - -
  - -
  - -
- 콘솔 에러 Top3(메시지/건수):
  - -
  - -
  - -
- 서버 에러로그 Top3(키워드/건수):
  - -
  - -
  - -

### (처리시간) end-to-end 리드타임(대략)
- 리드타임(대략): -
- 샘플 caseId: -

### (이슈) Top3 이슈(고정 포맷)

| 제목 | Sev(1~3) | 영향(몇 케이스) | 재현 steps | 관련 caseId | 현재상태(조치중·대기·완료) | 오너 | ETA | 비고 |
|---|---:|---:|---|---|---|---|---|---|
| 없음 | - | - | - | - | - | - | - | - |
| 없음 | - | - | - | - | - | - | - | - |
| 없음 | - | - | - | - | - | - | - | - |

---

## 케이스 단위 기록(선택)

| 날짜 | caseId | stage(막힌 지점) | action(막힌 액션) | reasonKo/에러 | 타임라인 캡처 링크 | 조치/결과 |
|---|---|---|---|---|---|---|
| 2026-04-18 | case_8998ad57-302a-4ba6-8e25-4bc74dc09b4e | completed | Gate 성공 검증 | - | - | 성공 (증거 확보 완료) |
| 2026-04-18 | case_fail_4a2002a0-6c73-4dc5-8d18-b714259eb7c4 | completed | Gate 실패 검증 | 서류 누락 | - | ok=false, evidenceId 반환 확인 |
| 2026-04-18 | case_fail_a7bc2848-418e-4861-949a-30c6213fc85e | completed | Gate 실패 검증 | 서류 누락 | - | ok=false, evidenceId 반환 확인 |

<!-- OPS_LOG_AUTO:END -->
