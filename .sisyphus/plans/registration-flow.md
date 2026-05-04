# Registration Flow Completion Plan

## Overview
Complete the end-to-end registration flow by connecting existing backend APIs to frontend UIs across user-web, partner-console, and ops-console.

## TODOs

### Phase 1: Revenue Gate — Payment
- [x] T1: Connect TossPaymentModal in user-web SubmissionDetail — enable payment after quote acceptance

### Phase 2: Document Flow
- [x] T2: Add document upload UI in user-web SubmissionDetail — users upload required documents
- [x] T3: Add document approval/rejection UI in partner-console — partners review and approve/reject uploaded documents

### Phase 3: Workflow Advancement
- [x] T4: Add workflow state transition buttons in partner-console — partners advance cases through the state machine
- [x] T5: Add workflow status timeline in user-web SubmissionDetail — users see real-time case progress

### Phase 4: B2G & Completion
- [x] T6: Add B2G credential registration UI in partner-console — already exists in B2gCredentials.tsx/Settings.tsx
- [x] T7: Add filing submission flow in partner-console — B2gSubmissions.tsx rewritten 35→326 lines with submission trigger, fee payment, filing evidence

## Final Verification Wave
- [x] F1: TypeScript build passes across all 4 apps (functions, user-web, partner-console, ops-console)
- [x] F2: Code quality review — no TODOs, no `as any`, no empty catches in changed files
- [x] F3: Security review — no critical vulns, 3 minor defense-in-depth notes
- [x] F4: End-to-end flow verification — user can create case → upload docs → pay → partner reviews → advances workflow
