# 09 — Leave Requests — Employee Cancellation

**What to build:** Employee self-cancellation of pending leave requests. Strictly limited to own requests in `pending` status only.

**Blocked by:** 05 — Leave Submission and Listing

**Status:** done

- [x] `PATCH /leave-requests/:id/status` — Employee (or Line Manager acting as employee) transitions own `pending → cancelled`
- [x] Only valid when current status is `pending`; any other status returns 400
- [x] Employee can only cancel their own requests; 403 on another employee's request (token UID must match `leaveRequest.employeeId`)
- [x] AuditLog entry written on cancellation
- [x] Tests: Employee cancels own `pending` request → `cancelled`; Employee cancels own `approved` request → 400; Employee cancels another employee's request → 403; Line Manager cancels own `pending` request (as employee) → `cancelled`; AuditLog entry written

## Comments

- **2026-08-06** — Implemented Ticket 09. Added `resolveCancellationTransition` + `resolveTransition` ownership-aware dispatcher to `backend/src/routes/leave-requests.ts`, 9 new tests to `test/leave-requests.test.ts` (90 total in that file), and updated 1 obsolete Ticket 07 test.
- Design notes:
  - **Extends the existing transition framework.** `resolveTransition` is a single dispatch function that routes PATCH /:id/status to the correct resolver based on role *and* ownership:
    - HR Admin → `resolveAdminTransition` (final approval/rejection, Ticket 08)
    - Request owner (Employee, or Line Manager cancelling their own request) → `resolveCancellationTransition` (Ticket 09)
    - Line Manager (non-owner) → `resolveManagerTransition` (first-stage, Ticket 07)
    - Employee acting on another employee's request →403 FORBIDDEN
  - This replaces the previous inline ternary dispatcher. Manager and Admin resolvers are unchanged — no behaviour change for Tickets 07/08.
  - **No new schema fields.** SRS LEAVE-16 / UC-08 require only `status → cancelled`; no `cancelledAt` or `cancelledBy` metadata.
  - **Cancellation resolver checks** (in order): scope (403 if not owner), current status (400 if not pending), target validity (422 if not `"cancelled"`). This ordering mirrors Ticket 07's scope-first pattern so a non-owner learns nothing about the request's state.
  - Audit action: `leave_request.cancel`, `diff.status: { before: "pending", after: "cancelled" }`.
  - PATCH route gate widened from `requireRole("admin", "manager")` to `requireRole("admin", "manager", "employee")` per SRS LEAVE-16.
  - One obsolete Ticket 07 test ("returns 403 for an Employee token") updated: now asserts that an Employee acting on *another* employee's request returns403 (the employee's own request is routed to the cancellation resolver; they get422 for any target other than `"cancelled"`).
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **244 passed** (7 files, incl. 90 leave-requests tests).
