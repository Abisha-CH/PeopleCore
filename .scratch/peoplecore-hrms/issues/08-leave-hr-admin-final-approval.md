# 08 — Leave Requests — HR Admin Final Approval and Override

**What to build:** HR Admin final-stage approval, rejection, and unrestricted modification/deletion of leave requests. Handles both the standard two-stage path (after Line Manager approval) and the direct path (employees with no assigned Line Manager).

**Blocked by:** 07 — Leave Requests — Line Manager First-Stage Approval

**Status:** done

- [x] `PATCH /leave-requests/:id/status` — HR Admin transitions `manager_approved → approved`, `manager_approved → rejected`, `pending → approved`, or `pending → rejected`
- [x] `pending → approved|rejected` is only valid when `employee.lineManagerId` is not set (no Line Manager assigned)
- [x] Approve records: `reviewedBy` (HR Admin's `employeeId`) and `reviewedAt`
- [x] Reject records: `reviewedBy`, `reviewedAt`, `rejectionReason` (required — reject 422 if missing)
- [x] `PUT /leave-requests/:id` — HR Admin modifies any field on any leave request regardless of status
- [x] `DELETE /leave-requests/:id` — HR Admin deletes any leave request regardless of status
- [x] AuditLog entry written on every transition, update, and delete
- [x] All endpoints: HR Admin only; Line Manager and Employee return 403
- [x] Tests: HR Admin approves `manager_approved` → `approved`; HR Admin rejects `manager_approved` → `rejected`; HR Admin approves `pending` (no Line Manager) → `approved`; HR Admin rejects `pending` (no Line Manager) → `rejected`; missing `rejectionReason` → 422; `pending → approved` when Line Manager IS assigned → 400; HR Admin PUT modifies any status; HR Admin DELETE removes any status; Line Manager → 403; Employee → 403; AuditLog entries written

## Comments

- **2026-08-06** — Implemented Ticket 08. Added HR Admin final-approval to `PATCH /api/leave-requests/:id/status`, plus `PUT /api/leave-requests/:id` and `DELETE /api/leave-requests/:id` overrides in `backend/src/routes/leave-requests.ts`, and 31 new tests to `test/leave-requests.test.ts` (81 total in that file). One obsolete Ticket 07 test ("HR Admin → 403 on PATCH") was removed because HR Admin now legitimately uses the endpoint.
- Design notes:
  - **Shared transition plumbing.** The Ticket 07 PATCH handler was refactored into `runStatusTransition(req, res, next, resolve)` — a single code path handling 401/404, persistence, re-read, audit, and response — with a `TransitionResolver` callback. `resolveManagerTransition` (Ticket 07) and `resolveAdminTransition` (Ticket 08) contain only role-specific scope/status validation. Manager behaviour, messages, and tests are unchanged.
  - **Single PATCH route, role dispatch.** Both roles hit one route gated `requireRole("admin", "manager")`; the handler dispatches on `req.auth.role`. (Two routes on the same path with different role gates would 403 on the first non-match.)
  - **Direct path (C-09 / LEAVE-13).** `resolveAdminTransition` allows `pending → approved|rejected` only when `employee.lineManagerId` is unset; otherwise 400 `INVALID_STATUS_TRANSITION` ("must first be reviewed by the employee's Line Manager"). Standard path requires current status `manager_approved`; any other current status → 400.
  - **Final-stage writes.** Approve writes only `status`, `reviewedBy`, `reviewedAt`. Reject additionally requires `rejectionReason` (422 `INVALID_REJECTION_REASON` if missing) and writes it. Manager-stage fields (`managerId`, `managerActionAt`) are never overwritten, so the two-stage history is preserved.
  - **Audit actions.** `leave_request.approve` / `leave_request.reject` (with `diff.status.before/after`), `leave_request.update` (with field-level diff), `leave_request.delete` (no diff).
  - **PUT override (LEAVE-15).** Validates only the substantive fields (employeeId, leaveTypeId, startDate, endDate, isHalfDay, halfDayPeriod, numberOfDays, reason, status) via the new `validateLeaveRequestUpdate` in `src/lib/validate-leave-request.ts`; system/attribution fields (`submittedAt`, `manager*`, `reviewed*`) are ignored so the audit trail stays coherent. Entitlement/balance checks are deliberately NOT re-run.
  - **DELETE override (LEAVE-15).** Returns 200 with the deleted request (matches `leave-types` convention).
  - Added `LEAVE_REQUEST_STATUSES` + `isLeaveRequestStatus` type guard to `src/types/index.ts` (mirrors the `ROLES`/`isValidRole` pattern).
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **235 passed** (7 files, incl. 81 leave-requests tests).
