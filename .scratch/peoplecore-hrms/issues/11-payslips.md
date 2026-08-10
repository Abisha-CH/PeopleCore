# 11 — Payslips

**What to build:** Full payslip lifecycle — draft creation, deduction editing with netSalary recomputation, publishing, and role-scoped retrieval. Employees see only their own published payslips; HR Admin sees all.

**Blocked by:** 10 — Payroll Profiles

**Status:** done

- [x] `POST /payslips` — HR Admin generates a draft payslip for an employee for a given `month` and `year`; `baseSalary` snapshot copied from PayrollProfile at generation time; initial status = `draft`
- [x] `GET /payslips?employeeId=:id` — HR Admin sees all statuses for any employee; Employee sees own published only; Line Manager sees own published only
- [x] `GET /payslips/:id` — HR Admin (any); Employee (own published only — 403 on draft or another employee's); Line Manager (own published only)
- [x] `PUT /payslips/:id` — HR Admin edits deductions (`Array<{label: string, amount: number}>`); `netSalary = baseSalary − sum(deductions[].amount)` recomputed and stored on every update; only on `draft` status
- [x] `PATCH /payslips/:id/publish` — HR Admin sets status to `published`; no unpublish operation
- [x] `DELETE /payslips/:id` — HR Admin deletes a draft payslip
- [x] AuditLog entry written on create, update, publish, and delete
- [x] `POST`, `PUT`, `PATCH /publish`, `DELETE`: HR Admin only (403 for Employee and Line Manager)
- [x] Tests: draft created with correct `baseSalary` snapshot; deductions stored correctly; `netSalary` recalculated on update; publish transitions to `published`; Employee cannot see own draft (filtered out); Employee cannot see another employee's payslip; HR Admin sees all statuses and all employees; Line Manager sees only own published; AuditLog entries on create, update, publish, delete

## Comments

- **2026-08-06** — Implemented Ticket 11. Added `POST /api/payslips`, `GET /api/payslips` (role-scoped list with `employeeId`/`status` filters for HR Admin), `GET /api/payslips/:id`, `PUT /api/payslips/:id`, `PATCH /api/payslips/:id/publish`, `DELETE /api/payslips/:id` in `backend/src/routes/payslips.ts`, plus 50 new tests in `test/payslips.test.ts` (320 total across 9 files).
- Design notes:
  - **Schema.** Doc ID = `${employeeId}_${year}-${month}` under `/payrollProfiles/{employeeId}/payslips/{payslipId}` (SRS §8.4). Deterministic IDs guarantee at most one payslip per employee/month/year at the storage layer, and duplicate generation is additionally guarded by a Firestore transaction.
  - **Generation transaction.** `POST /payslips` runs inside `db.runTransaction`: (1) read the PayrollProfile for the `baseSalary` snapshot, (2) read the deterministic doc (must not exist → 409 `PAYSLIP_EXISTS`), (3) create the draft payslip. This makes duplicate generation impossible even under concurrent requests. All six endpoints are admin-only via `requireRole("admin")`.
  - **Snapshot stability.** The payslip stores its own `baseSalary` and `netSalary` at generation time; deductions editing recomputes `netSalary` from the stored snapshot, never from the live PayrollProfile. A regression test generates a payslip at salary 5000, raises the profile to 7000, and asserts the historical payslip still holds 5000. A second regression test verifies first generation → 201, second generation → 409, and exactly one doc in `collectionGroup("payslips")`.
  - **Over-deduction guard (per approval).** `PUT /payslips/:id` returns 422 `DEDUCTIONS_EXCEED_SALARY` when `sum(deductions[].amount) > baseSalary`.
  - **Status lifecycle.** `draft → published` only. No unpublish. Edits (`PUT`), and `DELETE` are rejected with 400 `INVALID_STATUS` once published; `PATCH /publish` rejects a second publish the same way.
  - **Read access.** `GET /:id` — HR Admin any; Employee/Line Manager own published only (403 on own draft or another employee's). `GET /` — HR Admin all with optional `employeeId`/`status` filters (invalid status → 422 `INVALID_STATUS`); Employee/Line Manager own published only. List sorted year desc, month desc (UC-10).
  - **Audit.** `payslip.create` (no diff), `payslip.update` (field-level diff on `deductions`/`netSalary`), `payslip.publish` (`status: draft → published`), `payslip.delete` (no diff).
  - **Mock extensions.** `test/helpers/memory-firestore.ts` gained `MemoryDocumentReference.collection()` (subcollection navigation), `collectionGroup(name)` with `where`/`orderBy`/`limit` support (scans paths whose second-to-last segment matches the group name), and a single-threaded `runTransaction`/`MemoryTransaction` (read-verify-write ordering). These also unblock Ticket 13's `draftPayslipCount` via `collectionGroup("payslips").where("status","==","draft")`.
  - **Required indexes.** A composite index may be needed in production for Ticket 13's collection-group + `status` filter (Firestore auto-indexes equality on a single field but not cross-collection-group equality + sort). No indexes were required for this ticket's tests.
- Verification: `typecheck` ✓, `lint` ✓, `build` ✓, `npm test` → **320 passed** (9 files, incl. 50 payslip tests).
