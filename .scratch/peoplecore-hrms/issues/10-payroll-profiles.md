# 10 — Payroll Profiles

**What to build:** HR Admin management of PayrollProfile records, with read-only access for the owning Employee. Stores banking and salary details per employee. Employees can verify their own banking details but cannot modify them. Line Managers have no access.

**Blocked by:** 01 — Scaffold, Auth, and Audit Infrastructure; 03 — Employee Management

**Status:** done

- [x] `POST /payroll-profiles` — HR Admin creates a PayrollProfile (`employeeId`, `bankAccountNumber`, `bankName`, `baseSalary`)
- [x] `GET /payroll-profiles/:employeeId` — HR Admin reads any PayrollProfile; Employee reads own PayrollProfile only (token UID must match `:employeeId` — 403 otherwise)
- [x] `PUT /payroll-profiles/:employeeId` — HR Admin updates a PayrollProfile
- [x] One PayrollProfile per employee
- [x] AuditLog entry written on create and update
- [x] Authorization:
  - HR Admin: create, read (any), update
  - Employee: read own only; 403 on create, update, or another employee's profile
  - Line Manager: 403 on all PayrollProfile endpoints
- [x] Tests: HR Admin creates, reads any, updates PayrollProfile; Employee reads own PayrollProfile successfully; Employee reads another employee's PayrollProfile → 403; Employee attempts create → 403; Employee attempts update → 403; Line Manager gets 403 on all endpoints; AuditLog entries on create and update

## Comments

- **2026-08-06** — Implemented Ticket 10. Added `POST /api/payroll-profiles`, `GET /api/payroll-profiles/:employeeId`, `PUT /api/payroll-profiles/:employeeId` in `backend/src/routes/payroll-profiles.ts`, plus 26 new tests in `test/payroll-profiles.test.ts` (270 total across 8 files).
- Design notes:
  - **Schema.** Doc ID = `employeeId` at `/payrollProfiles/{employeeId}` per SRS §8.1, enforcing one profile per employee at the storage layer. This placement is required so Ticket 11 payslips attach as a subcollection (`/payrollProfiles/{employeeId}/payslips/{payslipId}`, SRS §8.4) — payslips are not a top-level collection. `createdAt`/`updatedAt` are stamped via `FieldValue.serverTimestamp()`; `createdAt` is never overwritten on update.
  - **Permissions.** POST/PUT gated `requireRole("admin")`. GET gated `requireAuth` only with an in-handler check: HR Admin reads any; the owning Employee reads own only; Line Managers get 403 even on their own profile (per ticket).
  - **Validation.** `src/lib/validate-payroll-profile.ts` — `validatePayrollProfileCreate` (adds `employeeId`) and `validatePayrollProfileInput` (the three business fields) shared with PUT full-replace. All failures 422 with `INVALID_*` codes, mirroring the leave-requests convention. `employeeId` must reference an existing Employee (404 via reused `fetchEmployee`).
  - **Business rules.** Create returns 409 `PAYROLL_PROFILE_EXISTS` on a second profile for the same employee. No DELETE / list endpoint (out of ticket scope).
  - **Audit.** `payroll_profile.create` (no diff) and `payroll_profile.update` (field-level diff). `computeDiff` lives in `src/services/payroll-profiles.ts` (not the router) and compares only the three business fields — `employeeId` (identity) and `createdAt`/`updatedAt` (system timestamps) are excluded so the diff shows exactly what HR Admin changed.
  - **Ticket 11 compatibility.** Updates write only the business fields + `updatedAt` via `doc.update()` (shallow merge) — payslip snapshot data lives in the subcollection and is never touched. A regression test seeds a historical payslip and asserts the snapshot survives a salary change unchanged while the audit diff records only `baseSalary: { before, after }`.
  - **No required indexes** for this ticket — all access is by document ID or a single exists-check. Ticket 11's payslip listing may need a composite index in production.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **270 passed** (8 files, incl. 26 payroll-profiles tests).
