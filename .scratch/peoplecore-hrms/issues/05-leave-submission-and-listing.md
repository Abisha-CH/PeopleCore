# 05 — Leave Requests — Submission and Listing

**What to build:** Leave request submission with full `numberOfDays` computation (including public holiday exclusion), half-day support, input validation, and role-scoped listing. This is the entry point for all leave workflows.

**Blocked by:** 03 — Employee Management; 04 — Leave Configuration

**Status:** ready-for-agent

- [x] `POST /leave-requests` — Employee or Line Manager submits a leave request with `leaveTypeId`, `startDate`, `endDate`, `reason`; optionally `isHalfDay: true` and `halfDayPeriod` (`morning` or `afternoon`)
- [x] Full-day `numberOfDays`: weekday count (Mon–Fri) between `startDate` and `endDate` inclusive, minus any PublicHoliday dates in that range that fall on weekdays
- [x] Half-day `numberOfDays = 0.5`; `startDate` must equal `endDate`
- [x] New request status is always `pending`; `submittedAt` is set to server timestamp
- [x] `employee.lineManagerId` is read at submission time to determine routing (manager-staged vs. direct-to-HR-Admin)
- [x] Validation: `leaveTypeId` must reference an existing LeaveType — reject 422 if not found
- [x] Validation: for capped leave types, a LeaveEntitlement or EmployeeLeaveEntitlement must exist — reject 422 if not found
- [x] Validation: half-day requires `startDate = endDate` — reject 422 otherwise
- [x] Validation: full-day requires `startDate ≤ endDate` — reject 422 otherwise
- [x] AuditLog entry written on create
- [x] `GET /leave-requests` — HR Admin sees all; Line Manager sees only requests from their direct reports (`employee.lineManagerId = requestingManager.employeeId`); Employee sees only own
- [x] `GET /leave-requests/:id` — HR Admin (any); Line Manager (own direct reports only; 403 otherwise); Employee (own only; 403 otherwise)
- [x] Tests: full-day `numberOfDays` weekday count; full-day spanning public holidays reduces count; full-day with no public holidays equals raw weekday count; half-day = 0.5; half-day with `startDate ≠ endDate` rejected 422; invalid `leaveTypeId` rejected 422; capped type with no entitlement rejected 422; `startDate > endDate` rejected 422; status set to `pending`; HR Admin list returns all; Line Manager list returns only direct reports; Employee list returns only own; AuditLog entry written

## Comments

- **2026-08-06** — Implemented Ticket 05. Route registered at `/api/leave-requests` in `backend/src/app.ts`. Added `lib/validate-leave-request.ts`, `services/leave-requests.ts` (shared `computeNumberOfDays`, `fetchHolidayDates`, `fetchEffectiveEntitlement`, `computeUsedDays`, `hasOverlappingRequest`), and `test/leave-requests.test.ts` (39 tests).
- Design notes:
  - `POST /leave-requests` is open to all three roles (admin, manager, employee) — managers and admins are also employees. The `employeeId` is always taken from the authenticated token (`req.auth.uid`), never from the body, per SEC-03. There is no way to create a request on behalf of another user.
  - Balance validation only applies to capped leave types: effective entitlement = per-employee override (`employeeLeaveEntitlements/{employeeId}_{leaveTypeId}`) wins over company-wide (`leaveEntitlements/{leaveTypeId}`); missing both → 422 `NO_ENTITLEMENT`. Used days sums `numberOfDays` of active requests (pending, manager_approved, approved — cancelled/rejected excluded) in the year of the new request's `startDate`; exceeding the balance → 422 `BALANCE_EXCEEDED`.
  - Overlap detection compares fixed-width `YYYY-MM-DD` strings lexicographically; cancelled/rejected requests never block a new submission → 409 `OVERLAPPING_REQUEST`.
  - All validation failures are HTTP 422 per the ticket spec (existing leave-config routes use 400).
  - Role scoping on list: HR Admin sees all; Line Manager sees only direct reports (`employee.lineManagerId = manager.employeeId`) and not their own requests; Employee sees only own. Single-GET enforces the same scoping with 403.
  - Optional list filters: `status`, `leaveTypeId`.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **193 passed** (7 files, incl. 39 leave-requests tests).
