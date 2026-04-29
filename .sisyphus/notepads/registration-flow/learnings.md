## 2026-04-29 Initialization

### API Patterns
- Backend uses `requireAuth` + role-specific middleware
- All responses use `ok(res, data)` / `fail(res, status, code, message)` helpers
- Frontend uses `fetch()` with `Authorization: Bearer ${token}` header
- `getApiBaseUrl()` returns `""` in production (Firebase Hosting rewrites `/v1/**` → `api` Cloud Function)
- Partner-console uses `X-Partner-Id` header for superadmin context switching

### Workflow State Machine
- States: draft_filing → under_review → awaiting_payment → filing_submitted → completed
- Also: needs_revision (partner requests revision from under_review)
- Events: SUBMIT_DOCS (user), APPROVE_ALL_DOCS (partner), REQUEST_REVISION (partner), COMPLETE_FILING (partner)
- GET /v1/cases/:caseId/transitions returns allowed events for current state

### Payment Flow
- TossPaymentModal component exists in user-web but not rendered
- Backend supports: POST /v1/user/payments (create), POST /v1/user/payments/:id/confirm (confirm), GET /v1/user/payments (list)
- Auto-converts to KRW for TossPayments
- Uses Idempotency-Key header

### Document Flow
- Upload: POST /v1/cases/:caseId/documents/upload-url → presigned URL → PUT to GCS
- Review: PATCH /v1/cases/:caseId/documents/:docId/status → { status: "approved"|"rejected", rejectReason? }
- List: GET /v1/cases/:caseId/documents

### Quote Flow
- Draft: POST /v1/partner/cases/:caseId/quotes/draft
- Finalize: POST /v1/partner/cases/:caseId/quotes/:quoteId/finalize
- Accept: POST /v1/user/cases/:caseId/quotes/:quoteId/accept (requires Idempotency-Key)
- Accept triggers case status → payment_pending

### CSS System
- Use `ar-*` CSS variables (e.g., var(--ar-primary), var(--ar-bg))
- Use `.ar-card`, `.ar-badge`, `.ar-table` classes
- Inline styles only — NO Tailwind utility classes
- Korean labels throughout
