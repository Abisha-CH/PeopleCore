# 04 — Leave Configuration (Types, Entitlements, Overrides, Public Holidays)

**What to build:** All HR Admin configuration endpoints that leave submission depends on: leave type management, company-wide entitlements, per-employee entitlement overrides, and public holiday management. Every write is audit-logged. All endpoints are HR Admin-only.

**Blocked by:** 01 — Scaffold, Auth, and Audit Infrastructure

**Status:** ready-for-agent

- [x] `POST|GET|PUT|DELETE /leave-types` — HR Admin CRUD on LeaveType (`leaveTypeId`, `name`, `isCapped`, `defaultDaysPerYear`)
- [x] DELETE on a LeaveType preserves existing LeaveRequest documents (they retain their `leaveTypeId`)
- [x] `GET|PUT /leave-entitlements/:leaveTypeId` — HR Admin reads and updates company-wide entitlement for a capped leave type
- [x] `POST|GET|PUT|DELETE /employee-leave-entitlements` — HR Admin creates/reads/updates EmployeeLeaveEntitlement; doc ID = `{employeeId}_{leaveTypeId}`
- [x] `POST|GET|PUT|DELETE /public-holidays` — HR Admin CRUD on PublicHoliday (`publicHolidayId`, `name`, `date`, `year`)
- [x] `GET /public-holidays?year=:year` — list filterable by year
- [x] `year` is derived from `date` on create and update — not provided separately by the caller
- [x] Duplicate public holiday dates (same `date` value) are rejected with HTTP 409
- [x] AuditLog entry written on every create, update, and delete across all four resource types
- [x] All write endpoints return 403 for Employee and Line Manager roles
- [x] All read endpoints return 403 for Employee and Line Manager roles
- [x] Tests: HR Admin CRUD for all four resource types; Employee and Line Manager get 403 on writes and reads; duplicate public holiday date rejected 409; `year` derived correctly; EmployeeLeaveEntitlement lookup by compound doc ID; AuditLog entries written

## Comments

- **2026-08-06** — Implemented Ticket 04. Routes registered at `/api/leave-types`, `/api/leave-entitlements`, `/api/employee-leave-entitlements`, `/api/public-holidays` in `backend/src/app.ts`. Added `lib/validate-leave-config.ts`, `services/leave-config.ts`, `services/employees.ts` (shared `fetchEmployee`/`toEmployee`), and `test/leave-config.test.ts` (79 tests).
- Design notes:
  - `PUT /leave-entitlements/:leaveTypeId` is an upsert (create → 201, update → 200); overrides use strict POST=create (409 on duplicate compound ID) + PUT=update + DELETE.
  - Deleting a LeaveType or uncapping a capped one cascades: company-wide entitlement and all per-employee overrides are removed, each with its own audit entry (`leave_entitlement.delete`, `employee_leave_entitlement.delete`). LeaveRequest documents are untouched.
  - Entitlements/overrides only apply to capped leave types (`UNCAPPED_LEAVE_TYPE` → 400).
  - Duplicate LeaveType names rejected case-insensitively (409); duplicate public holiday dates rejected (409).
  - `year` is always derived from `date` server-side.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **154 passed** (6 files, incl. 79 leave-config tests).
