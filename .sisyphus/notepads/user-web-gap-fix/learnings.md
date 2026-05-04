## 2026-04-30 Initialization

### API Patterns
- Frontend uses `fetch()` with `Authorization: Bearer ${token}` header
- `getApiBaseUrl()` returns `""` in production (Firebase Hosting rewrites `/v1/**` → `api` Cloud Function)
- In local emulator: `http://127.0.0.1:5001/{projectId}/asia-northeast3/api`
- Response shape: `{ ok: true, data: { ... } }` or `{ ok: false, error: { code, messageKo } }`
- Helper pattern from SubmissionDetail: `apiGet(path)` and `apiPost(path, body)` extract `json.data`

### CSS Design System
- CSS variables with `--uw-*` prefix (e.g. `var(--uw-brand)`, `var(--uw-bg)`)
- Component classes: `.uw-btn`, `.uw-btn-brand`, `.uw-card`, `.uw-badge`, `.uw-input`
- Button variants: `-brand`, `-dark`, `-outline`, `-ghost`, `-soft`
- Button sizes: `-sm`, default, `-lg`
- Inline styles used throughout — NO Tailwind utility classes in markup
- Tailwind imported but only for base/reset utilities

### Routing
- BrowserRouter in App.tsx, nested routes under DashLayout (Outlet)
- AuthGuard wraps protected routes
- Lazy loading: SubmissionDetail uses `React.lazy`

### Auth
- Firebase Auth with `useAuth()` hook providing `{ token, isReady }`
- AuthContext in `./context/AuthContext.tsx`

### i18n
- react-i18next configured with HttpBackend loading from `/locales/{{lng}}/{{ns}}.json`
- Fallback language: "en"
- Korean (ko) and English (en) supported

### Existing Funnel Backend APIs
- `POST /v1/funnel/intent` — submit intent text, returns sessionId + first question
- `POST /v1/funnel/sessions/:sessionId/answer` — submit answer, returns nextQuestion + preview
- `GET /v1/funnel/sessions/:sessionId/results` — returns recommended + compareTop3 + sponsored

### Existing Submission APIs
- `GET /v1/user/submissions` — list user's submissions
- `POST /v1/user/submissions` — create submission
- `POST /v1/user/submissions/:id/submit` — submit documents

### Existing User APIs
- `GET/PUT /v1/user/notification-settings` — notification preferences
- `GET/PUT /v1/user/push-tokens` — push token management

## 2026-04-30 Funnel Implementation

### Funnel Flow
- Intent input → POST /v1/funnel/intent → sessionId + first question
- Question answering → POST /v1/funnel/sessions/:sessionId/answer → next question or isCompleted
- Results → GET /v1/funnel/sessions/:sessionId/results → recommended + compareTop3 + sponsored
- Partner selection → POST /v1/user/submissions with { casePackId: "auto", partnerId, funnelSessionId }

### Routing
- `/funnel` — intent input page (no sessionId)
- `/funnel/:sessionId` — diagnosis questions (reads sessionId from URL params)
- `/funnel/:sessionId/results` — partner recommendation results
- All routes nested under AuthGuard + DashLayout

### UI Patterns Used
- `.uw-container` with maxWidth for page centering
- `.uw-card` for content cards, `.animate-slide-up` / `.animate-fade-in` for transitions
- `.uw-btn`, `.uw-btn-brand`, `.uw-btn-outline`, `.uw-btn-ghost`, `.uw-btn-lg`, `.uw-btn-sm`
- `.uw-badge`, `.uw-badge-brand` for labels
- `.uw-input` for text inputs/textareas
- `.uw-tabular` for numeric alignment
- Progress bar: 6px height, `var(--uw-brand)` fill, `var(--uw-surface)` track

### TypeScript
- Generic `apiPost<T>` and `apiGet<T>` helpers to avoid `any`
- Inline interface declarations for API response types within function scope
- `useParams<{ sessionId: string }>()` for typed route params

## 2026-04-30 Dashboard Functional Hub

### FloatingChatWidget
- Has internal `isOpen` state — cannot control from outside without modifying the widget
- Takes `{ token: string }` as required prop
- Lazy-load with `Suspense` — use `fallback={null}` to avoid flicker

### DashLayout Relative Paths
- When importing from `layouts/DashLayout.tsx`, components are at `../components/` not `./components/`
- Easy to get wrong when lazy-loading

### Dashboard Design Pattern
- Used `auto-fill` grid with `minmax(320px, 1fr)` for responsive card grid without media queries
- Skeleton loading with CSS `pulse` animation
- Hover effects via inline `onMouseEnter`/`onMouseLeave` handlers (consistent with existing pattern)
- Status badge mapping: use className composition `uw-badge uw-badge-{variant}`

### Settings Page
- `GET/PUT /v1/user/notification-settings` for notification prefs
- Webhook URL management: add/remove with list display
- Language/currency stored in localStorage only (UI preference, no backend)
- Logout: `signOut(auth)` from `firebase/auth` directly in component — simpler than passing through context
