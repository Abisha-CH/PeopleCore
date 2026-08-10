# 07 — Leave Requests — Line Manager First-Stage Approval

**What to build:** The first-stage leave approval workflow. Line Manager approves or rejects a pending request from one of their direct reports. Scope is strictly enforced server-side.

**Blocked by:** 05 — Leave Submission and Listing

**Status:** ready-for-agent

- [x] `PATCH /leave-requests/:id/status` — Line Manager transitions `pending → manager_approved` (approve) or `pending → rejected` (reject)
- [x] Approve records: `managerId` (requesting Line Manager's `employeeId`) and `managerActionAt`
- [x] Reject records: `managerId`, `managerActionAt`, `managerRejectionReason` (required — reject 422 if missing)
- [x] Only valid on requests with status `pending`; any other current status returns 400
- [x] Authorization: Line Manager only; the submitting employee's `lineManagerId` must equal the requesting Line Manager's `employeeId` — 403 otherwise
- [x] Employee attempting this endpoint: 403
- [x] HR Admin attempting this endpoint: 403 (HR Admin uses the final-approval endpoint instead)
- [x] AuditLog entry written on every status transition
- [x] Tests: Line Manager approves own direct report's pending request → `manager_approved`; Line Manager rejects with reason → `rejected`; Line Manager acts on non-direct-report → 403; acting on non-`pending` status → 400; missing `managerRejectionReason` on reject → 422; Employee → 403; HR Admin → 403; AuditLog entry written

## Comments

- **2026-08-06** — Implemented Ticket 07. Added `PATCH /api/leave-requests/:id/status` to `backend/src/routes/leave-requests.ts` and 12 new tests to `test/leave-requests.test.ts` (51 total in that file).
- Design notes:
  - Dependency review confirmed the Ticket 05 `LeaveRequest` schema already exposes every field this workflow needs (`managerId`, `managerActionAt`, `managerRejectionReason`) and `serialise()` already reads them — no schema change or data migration required. Ticket 08/09 fields (`reviewedBy`, `reviewedAt`, `rejectionReason`, `cancelled`) were also pre-declared in the type.
  - Route registered as `PATCH /:id/status` (not `PATCH /:id`) so Tickets 08 and 09 can reuse the same path with different role gates and transition sets.
  - Scope is checked before any status logic: a non-direct-report manager gets 403 and learns nothing about the request's state (SEC-08).
  - First-stage actions only accept `manager_approved` / `rejected`; any other target string → 422 `INVALID_STATUS`. Non-`pending` current state → 400 `INVALID_STATUS_TRANSITION`.
  - On approve, only `status`, `managerId`, `managerActionAt` are written. On reject, `managerRejectionReason` is required and trimmed.
  - Audit actions: `leave_request.manager_approve` / `leave_request.manager_reject`, each with `diff.status.before/after`.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **205 passed** (7 files, incl. 51 leave-requests tests).
