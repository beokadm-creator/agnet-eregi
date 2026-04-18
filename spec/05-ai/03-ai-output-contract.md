# AI 출력 데이터 계약(개발용)

AI 출력은 UI에 바로 노출될 수 있으므로, **출력 포맷(JSON Schema)**를 단일 소스로 유지합니다.

## 단일 소스

- AI 출력 Envelope JSON Schema: [`../../spec_ai_output_schema.json`](../../spec_ai_output_schema.json)

## 반드시 포함해야 하는 필드(안전/감사)

- `requestId`: 모든 AI 응답은 추적 가능해야 함(분쟁/오류 대응)
- `policyVersion`: 어떤 안전정책/프롬프트 버전인지
- `confidence`: low/medium/high
- `requiresHumanApproval`: 사용자 노출 전 승인 여부
- `sources[]`: 근거 포인터(casepack_rule/document/stats/sop)
- `outputs`: 질문/누락/불일치/견적/ETA/메시지초안 등

## UI 표준 연결

1. **AIReviewCard**는 `outputs.inconsistencies`, `outputs.fixRecommendations`를 사용  
2. **Message Draft**는 `outputs.messageDraft`를 사용하되, 발송은 승인 게이트 후  
3. **Value Preview**는 `outputs.priceRange`, `outputs.etaRange`를 “범위+전제조건”으로만 노출

