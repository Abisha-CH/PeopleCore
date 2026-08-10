Status: ready-for-agent

# PeopleCore HRMS — Spec

## Problem Statement

A company with 100–200 employees needs a centralised HR system to manage employee records, leave requests, and payroll data. Currently there is no system: HR admins manage this manually, employees have no self-service access to their own records or payslips, leave approvals have no structured workflow, and there is no audit trail of who changed what.

## Solution

Build PeopleCore — a web-based HRMS with three roles (HR Admin, Line Manager, Employee) and three modules:

- **Employee Management** — HR Admin manages full employee records including personal details; employees can view their own profile and update their phone number.
- **Leave Management** — Employees submit full-day and half-day leave requests across configurable leave types; `numberOfDays` is calculated excluding weekends and configured public holidays; Line Managers perform first-stage approval; HR Admin performs final approval; leave balances are computed on demand using per-employee or company-wide entitlements.
- **Payroll** — HR Admin manages payroll profiles and generates itemised payslips; employees view their own published payslips.

A full **Audit Log** records every significant action across all modules. Employees can **reset their own password** via Firebase Authentication's built-in email reset flow.

The system uses React + Vite on the frontend, Express + Firebase Admin SDK on the backend, Firestore as the database, and Firebase Authentication for identity. All Firestore access goes through the Express REST API — the React client never talks to Firestore directly (see ADR-0001).

## User Stories

### Authentication
1. As an HR Admin, I want to log in with my email and password, so that I can access the admin interface.
2. As a Line Manager, I want to log in with my email and password, so that I can review my direct reports' leave requests.
3. As an Employee, I want to log in with my email and password, so that I can access my own HR data.
4. As an HR Admin, I want to create user accounts by setting their email, role, and initial password directly, so that I can onboard staff without self-registration.
5. As a system, I want to store each user's role as a Firebase custom claim, so that the backend can enforce access control without a Firestore lookup on every request.
6. As a system, I want to reject API requests with a missing or invalid token with HTTP 401, so that unauthenticated access is blocked.
7. As a system, I want to return HTTP 403 when an authenticated user accesses an endpoint their role does not permit, so that role boundaries are enforced server-side.
8. As an Employee, I want to request a password reset email from the login screen, so that I can regain access if I forget my password.
9. As a Line Manager, I want to request a password reset email from the login screen, so that I can regain access if I forget my password.

### Dashboard
10. As an HR Admin, I want to see the total number of active employees on my dashboard, so that I have a quick headcount at a glance.
11. As an HR Admin, I want to see the count of leave requests with status `manager_approved` awaiting my final action, so that I know how many approvals are waiting.
12. As an HR Admin, I want to see the count of draft payslips not yet published on my dashboard, so that I don't forget to release payslips.
13. As a Line Manager, I want to see the count of pending leave requests from my direct reports on my dashboard, so that I can act promptly.
14. As an Employee, I want to see my leave balance for all capped leave types on my dashboard, so that I can plan my time off.
15. As an Employee, I want to see my pending leave requests on my dashboard, so that I can track what's awaiting approval.
16. As an Employee, I want to see the status of my most recent payslip on my dashboard, so that I know when it's been published.

### Employee Management
17. As an HR Admin, I want to create a new employee record with fields: fullName, email, phone, department, jobTitle, employmentType, startDate, status, nationalId, address, emergencyContact, and optionally lineManagerId, so that the employee's full details are stored.
18. As an HR Admin, I want to edit any field on any employee record, so that I can keep records accurate.
19. As an HR Admin, I want to set an employee's status to `inactive` to deactivate them, so that former staff are retained in the system but marked as no longer active.
20. As an HR Admin, I want to delete an employee record, so that test or erroneous records can be removed.
21. As an HR Admin, I want to view a list of all employees filterable by status and department, so that I can find staff quickly.
22. As an HR Admin, I want to assign a Line Manager to an Employee by setting their `lineManagerId`, so that leave requests are routed for first-stage approval.
23. As an Employee, I want to view my own profile including my national ID, address, and emergency contact, so that I can see my HR details.
24. As an Employee, I want to edit my own phone number, so that my contact details stay current.
25. As a system, I want to prevent an Employee from editing any field other than their own phone number, so that HR-managed data cannot be self-modified.
26. As a system, I want to prevent an Employee from viewing any other employee's profile, so that personal data is kept private.

### Leave Types and Entitlements
27. As an HR Admin, I want to create a new leave type with a name, capped/uncapped flag, and default days per year, so that the company can support any leave category needed.
28. As an HR Admin, I want to edit or delete existing leave types, so that the leave catalogue stays current.
29. As an HR Admin, I want to set a company-wide annual entitlement for any capped leave type, so that employees have a default allowance.
30. As an HR Admin, I want to set a per-employee entitlement override for a capped leave type, so that specific employees can have a different allowance from the company default.
31. As an HR Admin, I want to create a public holiday record with a name and date, so that `numberOfDays` calculations automatically exclude that day for all employees.
32. As an HR Admin, I want to edit or delete existing public holiday records, so that the holiday calendar stays accurate.
33. As an HR Admin, I want to view all configured public holidays filtered by year, so that I can review and manage the calendar for any given year.

### Leave Management
34. As an Employee, I want to submit a full-day leave request by specifying leave type, start date, end date, and reason, so that my time-off request enters the approval workflow.
35. As an Employee, I want to submit a half-day leave request by specifying leave type, a single date, morning or afternoon, and reason, so that I can take partial days off.
36. As a system, I want to calculate `numberOfDays` at submission time — `0.5` for half-day, weekday count excluding configured public holidays for full-day — so that the correct amount is deducted from the employee's balance.
37. As an Employee, I want to see the computed number of days and my remaining balance before I confirm my leave request, so that I can check I have sufficient entitlement.
38. As an Employee, I want to cancel my own leave request while it is still pending, so that I can withdraw a request I no longer need.
39. As a system, I want to prevent an Employee from performing any leave request transition other than pending → cancelled, so that only Line Managers and HR Admin can approve, reject, or modify requests.
40. As a Line Manager, I want to approve a pending leave request from one of my direct reports, so that it advances to HR Admin for final approval.
41. As a Line Manager, I want to reject a pending leave request from one of my direct reports with a rejection reason, so that the employee understands why it was declined at first stage.
42. As a system, I want to prevent a Line Manager from acting on leave requests from employees who are not their direct reports, so that approval authority is scoped correctly.
43. As an HR Admin, I want to perform final approval of a `manager_approved` leave request, so that the employee's absence is officially authorised.
44. As an HR Admin, I want to finally reject a `manager_approved` leave request with a rejection reason, so that the employee is informed.
45. As an HR Admin, I want to approve or reject a `pending` request directly when the employee has no assigned Line Manager, so that leave is not blocked.
46. As an HR Admin, I want to modify or delete any leave request regardless of its status, so that I can correct errors or handle exceptional cases.
47. As an HR Admin, I want to view all leave requests filterable by status and leave type, so that I can manage approvals efficiently.
48. As a Line Manager, I want to view leave requests submitted by my direct reports, so that I have visibility of their leave history.
49. As an Employee, I want to view my own leave history, so that I can track all my past and current requests.
50. As a system, I want to compute an employee's leave balance on demand using their per-employee override (if set) or the company-wide default, minus approved days in the current year, so that the balance is always accurate.

### Payroll
51. As an HR Admin, I want to create a PayrollProfile for an employee recording bank account number, bank name, and base salary, so that the employee's payroll details are stored.
52. As an HR Admin, I want to edit a PayrollProfile, so that I can update banking or salary details.
53. As an HR Admin, I want to generate a draft Payslip for an employee for a given month and year, populated with a snapshot of their current base salary, so that I have a starting point to itemise deductions.
54. As an HR Admin, I want to add, edit, and remove deduction line items (each with a label and amount) on a draft payslip, so that the payslip reflects the employee's actual take-home pay.
55. As a system, I want to compute `netSalary = baseSalary − sum(deductions[].amount)` and store it on the payslip, so that the employee sees the correct net figure.
56. As an HR Admin, I want to publish a payslip by changing its status from draft to published, so that the employee can view it.
57. As an Employee, I want to view my published payslips showing month/year, base salary, itemised deductions, and net salary, so that I have a clear record of my pay.
58. As a system, I want to hide draft payslips from Employee role requests, so that employees only see finalised payslips.
59. As a system, I want to prevent Employees from accessing any PayrollProfile data (bank account, base salary), so that sensitive payroll information is protected.

### Audit Log
60. As a system, I want to write an AuditLog entry after every create, update, delete, and status-transition operation, so that all significant actions are traceable.
61. As an HR Admin, I want to view the full audit log filterable by entity type, actor, and date range, so that I can investigate changes or suspicious activity.
62. As a system, I want to prevent Line Managers and Employees from accessing the audit log, so that audit data stays restricted to HR Admin.
63. As a system, I want AuditLog entries to be immutable, so that the audit trail cannot be tampered with.

## Implementation Decisions

- **Architecture**: All Firestore reads and writes go through Express REST endpoints. React never calls Firestore directly. Express middleware verifies the Firebase ID token and reads the role custom claim on every request. After every successful write, the route handler writes an AuditLog entry. See `docs/adr/0001-express-api-over-direct-firestore.md`.

- **Roles and claims**: Three roles — `admin`, `manager`, `employee` — stored as Firebase custom claims. Set at account creation by HR Admin, never self-assigned. Role changes require a token refresh before taking effect.

- **Password reset**: Triggered client-side via Firebase Auth SDK's `sendPasswordResetEmail`. The Express backend does not handle the reset link. No new API endpoint is needed — Firebase manages the token and reset flow end-to-end.

- **Firestore collections**:
  ```
  /employees/{employeeId}
  /payrollProfiles/{employeeId}
    /payslips/{payslipId}
  /leaveTypes/{leaveTypeId}
  /leaveRequests/{leaveRequestId}
  /leaveEntitlements/{leaveTypeId}
  /employeeLeaveEntitlements/{employeeId}_{leaveTypeId}
  /publicHolidays/{publicHolidayId}
  /auditLog/{auditLogId}
  ```

- **Employee schema**: `employeeId`, `fullName`, `email`, `phone`, `department` (free-text), `jobTitle`, `employmentType` (`full-time` | `part-time` | `contract`), `startDate`, `status` (`active` | `inactive`), `nationalId`, `address`, `emergencyContact` (`{ name, phone, relationship }`), `lineManagerId`. No photo field.

- **LeaveType schema**: `leaveTypeId`, `name`, `isCapped` (boolean), `defaultDaysPerYear`. Three types seeded at setup: Annual (capped), Medical (capped), Unpaid (uncapped). HR Admin can create additional types.

- **LeaveEntitlement schema**: doc ID = `leaveTypeId`, `daysPerYear`. One document per capped leave type.

- **EmployeeLeaveEntitlement schema**: `employeeId`, `leaveTypeId`, `daysPerYear`. Only created when HR Admin sets an override. Doc ID is `{employeeId}_{leaveTypeId}`.

- **PublicHoliday schema**: `publicHolidayId`, `name`, `date`, `year` (derived from `date` for efficient per-year queries). HR Admin creates, edits, and deletes public holidays. Applied globally — no per-region or per-employee holiday configuration. `numberOfDays` calculation on leave submission queries all public holidays for the relevant year and excludes any that fall on weekdays within the requested range. Existing `numberOfDays` values are not retroactively recalculated when holidays are added or removed.

- **LeaveRequest schema**: `leaveRequestId`, `employeeId`, `leaveTypeId`, `startDate`, `endDate`, `isHalfDay`, `halfDayPeriod` (`morning` | `afternoon`, only when half-day), `numberOfDays` (0.5 for half-day; weekday count excluding configured public holidays for full-day), `reason`, `status` (`pending` | `manager_approved` | `approved` | `rejected` | `cancelled`), `submittedAt`, `managerId`, `managerActionAt`, `managerRejectionReason`, `reviewedBy`, `reviewedAt`, `rejectionReason`.

- **Leave status lifecycle**:
  - Employee has Line Manager: `pending → manager_approved` (Line Manager) → `approved` (HR Admin) | `rejected` (HR Admin)
  - Employee has no Line Manager: `pending → approved | rejected` (HR Admin directly)
  - Employee cancels: `pending → cancelled` only
  - HR Admin can modify or delete at any stage

- **Leave balance formula** (computed on demand, not stored):
  ```
  effectiveDays = EmployeeLeaveEntitlement.daysPerYear (if override exists)
                  OR LeaveEntitlement.daysPerYear (company-wide default)
  balance = effectiveDays − sum(numberOfDays where status = 'approved' and year = currentYear and leaveTypeId matches)
  ```
  Only applies to leave types where `isCapped = true`.

- **AuditLog schema**: `auditLogId`, `actorId`, `actorRole`, `action` (e.g. `employee.create`, `leave_request.approve`), `targetType`, `targetId`, `timestamp`, `diff` (`{ field: { before, after } }`, omitted for create/delete). Written by the backend after every successful write; never modified or deleted.

- **Line Manager scoping**: A Line Manager may only act on leave requests where `employee.lineManagerId = lineManager.employeeId`. The API enforces this server-side — the middleware compares the requesting manager's employeeId against the request's submitter's `lineManagerId`.

- **Employee self-edit**: `PATCH /employees/:id/phone` enforces that the token UID matches the `employeeId` in the path. All other fields are HR Admin-only at the API level.

- **Dashboard aggregations**: All dashboard data is computed by querying existing collections — no new entities or counters.

## Testing Decisions

**Seam: the Express REST API layer.** All tests exercise the HTTP interface — request in, response out. No unit tests on isolated functions; no direct Firestore reads in assertions. One seam across the entire codebase.

**What makes a good test:**
- Sends a real HTTP request (via supertest or equivalent) to an Express route.
- Provides a mocked/stubbed token verifier in test mode with the appropriate role claim (`admin`, `manager`, or `employee`) and `employeeId`.
- Asserts on HTTP status code, response body shape, and — where necessary — a follow-up read request to confirm state was persisted correctly.
- Does not assert on internal Firestore document structure directly.
- Does not test implementation details like middleware internals or helper function outputs.

**Modules to test (by route group):**
- `POST /auth/create-account` — account creation with correct role claim assignment
- `POST /auth/reset-password` (or client-side Firebase call) — password reset email triggered, no token required
- `GET|POST|PATCH|DELETE /employees/*` — CRUD, new fields (nationalId, address, emergencyContact, lineManagerId), role-boundary enforcement
- `GET|POST|PUT|DELETE /leave-types/*` — HR Admin CRUD; Line Manager and Employee cannot write
- `GET|PUT /leave-entitlements/*` — HR Admin sets company-wide entitlements; Employee cannot write
- `GET|POST|PUT /employee-leave-entitlements/*` — HR Admin sets per-employee overrides; override takes precedence over company default in balance calculation
- `GET /leave-balance` — correct on-demand computation using override when present; correct computation for half-day requests; public holidays correctly excluded from full-day calculations
- `GET|POST|PATCH|DELETE /leave-requests/*`:
  - Full-day submission: `numberOfDays` excludes weekends and configured public holidays
  - Full-day spanning no public holidays: `numberOfDays` equals raw weekday count
  - Half-day submission: `numberOfDays = 0.5`, `startDate = endDate` enforced
  - Line Manager first-stage approve/reject (own direct reports only; 403 for others)
  - HR Admin final approve/reject (`manager_approved` → `approved`)
  - HR Admin direct approve/reject for employees with no Line Manager (`pending → approved`)
  - Employee cancel (own `pending` only; 400 for any other transition)
  - Status transition enforcement across all roles
- `GET|POST|PUT|DELETE /payroll-profiles/*` — HR Admin CRUD; Employee cannot access
- `GET|POST|PUT|DELETE /payslips/*` — draft/publish lifecycle; Employee sees only own published payslips
- `GET /dashboard` — correct aggregation per role (admin: `manager_approved` count; manager: pending direct-report count; employee: capped leave balances)
- `GET|POST|PUT|DELETE /public-holidays/*` — HR Admin CRUD; non-admin roles get 403; `numberOfDays` on a new leave request spanning a configured public holiday is reduced by 1 per excluded holiday
- `GET /audit-log` — HR Admin can read; Line Manager and Employee get 403; entries are immutable (no PUT/DELETE)

**Prior art:** No existing tests in the codebase (greenfield project). The test suite will be the first.

## Out of Scope

- Profile photo upload and Firebase Storage integration
- Mobile responsiveness

## Further Notes

- The SRS at `docs/SRS.md` is the authoritative requirements document for the workshop submission. This spec focuses on implementation decisions and testing strategy.
- The domain glossary at `CONTEXT.md` is the single source of truth for terminology. All code (variable names, route names, collection names) should use the vocabulary defined there.
- ADR-0001 (`docs/adr/0001-express-api-over-direct-firestore.md`) records the architectural decision to route all Firestore access through Express. Do not introduce direct Firestore client SDK usage in the React frontend.
- The `department` field on Employee is free-text. The recommended standard values (Engineering, HR, Finance, Operations, Sales) are documented in the SRS as guidance only and must not be enforced in code.
- Three default leave types (Annual, Medical, Unpaid) must be seeded into the `leaveTypes` and `leaveEntitlements` collections on first deployment. Unpaid has no LeaveEntitlement document.
- The `employeeLeaveEntitlements` doc ID convention is `{employeeId}_{leaveTypeId}` to allow efficient single-document lookups.
- The `publicHolidays` collection is empty on first deployment. HR Admin populates it before the first leave submission cycle. No holidays are pre-seeded.
