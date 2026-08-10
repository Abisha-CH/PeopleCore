# 03 — Employee Management

**What to build:** Full Employee CRUD for HR Admin plus the employee self-edit endpoint for phone. Covers all Employee fields including the new personal detail fields (`nationalId`, `address`, `emergencyContact`) and the `lineManagerId` assignment. Enforces role-scoped access at the API level — not just in the UI.

**Blocked by:** 01 — Scaffold, Auth, and Audit Infrastructure

**Status:** ready-for-agent

- [ ] `POST /employees` — HR Admin creates employee with all fields: `fullName`, `email`, `phone`, `department`, `jobTitle`, `employmentType`, `startDate`, `status`, `nationalId`, `address`, `emergencyContact`, optionally `lineManagerId`
- [ ] `GET /employees` — HR Admin lists all employees, filterable by `status` and `department`
- [ ] `GET /employees/:id` — HR Admin reads any employee; Employee reads own record only (403 on another employee's record)
- [ ] `PUT /employees/:id` — HR Admin full update on any employee record
- [ ] `DELETE /employees/:id` — HR Admin deletes any employee record
- [ ] `PATCH /employees/:id/phone` — Employee updates own phone only; token UID must match `:id`; any other field attempt returns 403; cross-user attempt returns 403
- [ ] `employmentType` validates to `full-time`, `part-time`, or `contract`; rejects other values
- [ ] `status` validates to `active` or `inactive`; rejects other values
- [ ] `emergencyContact` stores `{ name: string, phone: string, relationship: string }`
- [ ] `lineManagerId` must reference a user with the `manager` role
- [ ] AuditLog entry written on every create, update, and delete
- [ ] Line Manager has same own-record access as Employee; no access to other employees' records
- [ ] Tests: HR Admin CRUD with all fields; Employee reads own / 403 on other; Employee updates own phone / 403 on other fields / 403 on other employee; Line Manager own-record access; invalid `employmentType` and `status` rejected; AuditLog entries present
