# 13 — Dashboards

**What to build:** A single `GET /dashboard` endpoint returning a role-specific payload aggregated from existing collections. No new entities or counters — all values computed on the fly.

**Blocked by:** 03 — Employee Management; 06 — Leave Balance; 08 — HR Admin Final Approval; 09 — Employee Cancellation; 11 — Payslips

**Status:** done

- [x] `GET /dashboard` returns a role-specific payload inside a consistent `{ dashboard: { ... } }` envelope:
  - HR Admin: `{ activeHeadcount, managerApprovedLeaveCount, draftPayslipCount }`
  - Line Manager: `{ pendingDirectReportLeaveCount }` (scoped to requests where `employee.lineManagerId = lineManager.employeeId`)
  - Employee: `{ leaveBalances: [{leaveTypeId, name, balance}], pendingLeaveRequests: [...], latestPayslip: {month, year, status} }`
- [x] `activeHeadcount`: count of Employee documents with `status = 'active'`
- [x] `managerApprovedLeaveCount`: count of LeaveRequests with `status = 'manager_approved'`
- [x] `draftPayslipCount`: count of Payslips with `status = 'draft'` (via `collectionGroup("payslips")`)
- [x] `pendingDirectReportLeaveCount`: count of LeaveRequests with `status = 'pending'` and `employee.lineManagerId = requesting manager's employeeId`
- [x] `leaveBalances`: leave balance for each capped leave type (uses same formula as T06); uncapped types omitted
- [x] `pendingLeaveRequests`: Employee's own leave requests with `status = 'pending'`
- [x] `latestPayslip`: most recent published payslip by `year` then `month` descending
- [x] Authorization: any authenticated user; response payload is always role-specific — Employee cannot receive HR Admin or Line Manager fields
- [x] Tests: HR Admin receives correct three-metric payload; Line Manager receives scoped pending count; Employee receives own leave balances (capped only), own pending requests, own latest payslip; payloads do not bleed between roles; regression proving leave balance parity with Ticket 06 entitlement/usage rules

## Comments

- **2026-08-06** — Implemented Ticket 13. Added `GET /api/dashboard` in `backend/src/routes/dashboard.ts`, modular aggregation in `backend/src/services/dashboard.ts`, leave-balance computation in `backend/src/services/leave-balances.ts`, and the `LeaveBalance` type in `backend/src/types/index.ts`; wired the router in `app.ts` and added 20 tests in `test/dashboard.test.ts` (340 total across 10 files).
- Design notes:
  - **Response envelope (per approval).** Every role returns `{ dashboard: { ... } }`; the role-specific shape lives inside. Consumers branch on the fields present rather than a top-level role tag.
  - **Counting abstraction (per approval).** `countDocs()` in `services/dashboard.ts` is the only place that knows how a count is produced: it calls Firestore's aggregation `query.count()` when the SDK/harness exposes it and otherwise falls back to `query.get()` → `snapshot.size`. Both paths return the same number, so the route layer is unaware of the mechanism and the production aggregation can be exercised without touching any caller.
  - **Modular aggregation (per approval).** `computeAdminDashboard()`, `computeManagerDashboard()`, `computeEmployeeDashboard()` with small reusable helpers (`fetchDirectReportIds`, `countPendingDirectReports`, `fetchPendingLeaveRequests`, `fetchLatestPublishedPayslip`, `serialiseLeaveRequest`, `toIso`, `countDocs`) instead of one monolithic service. A single `getDashboard(actor)` dispatcher switches on `actor.role`.
  - **Leave-balance parity (per approval).** `services/leave-balances.ts` mirrors Ticket 06's rules: `effectiveDays = EmployeeLeaveEntitlement.daysPerYear ?? LeaveEntitlement.daysPerYear` (override wins), and `used = Σ numberOfDays` over requests whose status ∈ `{pending, manager_approved, approved}` and whose `startDate` year is the current year (cancelled/rejected excluded, year-scoped). Uncapped types and capped types with no entitlement configured are omitted. A dedicated regression test seeds an override plus approved/pending/manager_approved/cancelled/rejected and a previous-year request, then asserts the exact balances — proving dashboard output stays consistent with T06.
  - **`latestPayslip` strategy.** Reads the employee's own `/payrollProfiles/{uid}/payslips` subcollection directly (not a collection-group query) and picks the max by `(year, month)` among `published` rows. This avoids needing a composite collection-group index while per-employee payslips are small; falls back to `null` when there is no published payslip.
  - **404 semantics.** Manager and Employee dashboards fetch the actor's own Employee record first, so a missing record surfaces as 404 (matching the leave-request routes). The Admin dashboard aggregates globally and needs no employee record.
  - **Read-only.** No audit-log entries; the endpoint is a plain authenticated `GET` with no `writeRoute` pipeline.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **340 passed** (10 files, incl. 20 dashboard tests).
