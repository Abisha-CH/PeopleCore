# PeopleCore — Domain Glossary

HR system for a 100–200 employee company. Three modules: Employee Management, Leave Management, Payroll.

---

## Roles

**HR Admin**
A user with full administrative access across all three modules. Can create, edit, and delete Employee records; manage leave entitlements, leave types, and public holidays; approve or reject leave requests at the final stage; create and publish payslips; and view the audit log. Has authority over all Line Manager actions.

**Line Manager**
A role tier between Employee and HR Admin. A Line Manager is assigned to one or more Employees. Can view and perform the first-stage approval or rejection of leave requests submitted by their direct reports. Cannot access payroll data, create or delete employee records, or manage leave types, entitlements, or public holidays. When a Line Manager is assigned to an employee, their approval is required before HR Admin final approval; if no Line Manager is assigned, the request goes directly to HR Admin.

**Employee**
A user who can view their own profile, submit and cancel leave requests, and view their own published payslips. Can edit only their own `phone` field. Cannot access other employees' data.

---

## Entities

### Employee
A person employed by the company, represented in the system.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | string | Firestore document ID |
| `fullName` | string | |
| `email` | string | Used as Firebase Auth email |
| `phone` | string | Employee-editable |
| `department` | string | HR Admin-only |
| `jobTitle` | string | HR Admin-only |
| `employmentType` | enum | `full-time` \| `part-time` \| `contract` — HR Admin-only |
| `startDate` | date | HR Admin-only |
| `status` | enum | `active` \| `inactive` — HR Admin-only |
| `nationalId` | string | HR Admin-only |
| `address` | string | HR Admin-only |
| `emergencyContact` | object | `{ name: string, phone: string, relationship: string }` — HR Admin-only |
| `lineManagerId` | string | employeeId of the assigned Line Manager — HR Admin-only |

No photo field.

### PayrollProfile
Payroll and banking details for an Employee. Separate Firestore collection linked by `employeeId`.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | string | Foreign key to Employee |
| `bankAccountNumber` | string | |
| `bankName` | string | |
| `baseSalary` | number | |

Payslips live as a subcollection under PayrollProfile.

### Payslip
A monthly pay record generated and published by HR Admin.

| Field | Type | Notes |
|---|---|---|
| `payslipId` | string | Firestore document ID |
| `employeeId` | string | |
| `month` | number | 1–12 |
| `year` | number | |
| `baseSalary` | number | Snapshot at time of generation |
| `deductions` | Array<{ label: string, amount: number }> | Manually entered by HR Admin |
| `netSalary` | number | `baseSalary − sum(deductions)` |
| `generatedAt` | timestamp | |
| `status` | enum | `draft` \| `published` |

Deductions are manually entered — no tax logic, no EPF/SOCSO calculation.

### LeaveType
A configurable leave category managed by HR Admin.

| Field | Type | Notes |
|---|---|---|
| `leaveTypeId` | string | Firestore document ID |
| `name` | string | e.g. `Annual`, `Medical`, `Unpaid`, or any custom name |
| `isCapped` | boolean | If `true`, a company-wide entitlement applies; if `false`, no cap |
| `defaultDaysPerYear` | number | Company-wide default entitlement. Ignored when `isCapped` is `false`. |

HR Admin creates, edits, and deletes leave types. The three initial types (`Annual`, `Medical`, `Unpaid`) are seeded at setup. `Unpaid` has `isCapped: false`.

### PublicHoliday
A configured public holiday for a specific calendar year. Managed by HR Admin.

| Field | Type | Notes |
|---|---|---|
| `publicHolidayId` | string | Firestore document ID |
| `name` | string | e.g. `New Year's Day`, `National Day` |
| `date` | date | The calendar date of the holiday |
| `year` | number | Calendar year — used for efficient per-year queries |

Public holidays are applied globally (company-wide). HR Admin creates, edits, and deletes them. There is no per-region or per-employee holiday configuration.

### LeaveRequest
A request submitted by an Employee for time off.

| Field | Type | Notes |
|---|---|---|
| `leaveRequestId` | string | Firestore document ID |
| `employeeId` | string | |
| `leaveTypeId` | string | Reference to LeaveType document |
| `startDate` | date | |
| `endDate` | date | |
| `isHalfDay` | boolean | If `true`, the request covers a single half day |
| `halfDayPeriod` | enum | `morning` \| `afternoon` — only populated when `isHalfDay` is `true` |
| `numberOfDays` | number | Calculated at submission. Full-day: weekday count (Monday–Friday) between startDate and endDate inclusive, excluding any configured PublicHoliday dates that fall on weekdays within the range. Half-day: `0.5`. |
| `reason` | string | |
| `status` | enum | `pending` \| `manager_approved` \| `approved` \| `rejected` \| `cancelled` |
| `submittedAt` | timestamp | |
| `managerId` | string | employeeId of the Line Manager who acted at stage 1 |
| `managerActionAt` | timestamp | |
| `managerRejectionReason` | string | Populated when Line Manager rejects |
| `reviewedBy` | string | HR Admin employeeId who acted at stage 2 |
| `reviewedAt` | timestamp | |
| `rejectionReason` | string | Populated when HR Admin rejects |

Half-day requests must have `startDate = endDate`.

### LeaveEntitlement
Company-wide annual allowance for a leave type. One document per capped LeaveType.

| Field | Type | Notes |
|---|---|---|
| `leaveTypeId` | string | Foreign key to LeaveType (doc ID) |
| `daysPerYear` | number | Company-wide default |

Leave types with `isCapped: false` have no LeaveEntitlement document.

### EmployeeLeaveEntitlement
Per-employee override of the company-wide entitlement for a specific leave type. Optional — only exists when HR Admin has set an override for a specific employee.

| Field | Type | Notes |
|---|---|---|
| `employeeId` | string | |
| `leaveTypeId` | string | |
| `daysPerYear` | number | Overrides the company-wide LeaveEntitlement for this employee |

### AuditLog
A record of a significant system action. Written by the backend on every create, update, delete, and status-transition operation. Never modified or deleted.

| Field | Type | Notes |
|---|---|---|
| `auditLogId` | string | Firestore document ID |
| `actorId` | string | employeeId of the user who triggered the action |
| `actorRole` | enum | `admin` \| `manager` \| `employee` |
| `action` | string | e.g. `employee.create`, `leave_request.approve`, `payslip.publish` |
| `targetType` | string | Entity type affected, e.g. `Employee`, `LeaveRequest`, `Payslip` |
| `targetId` | string | Document ID of the affected entity |
| `timestamp` | timestamp | |
| `diff` | object | Key-value map of changed fields: `{ field: { before, after } }`. Omitted for create/delete. |

HR Admin can read the audit log. Line Managers and Employees cannot.

---

## Leave Balance

Not stored. Computed on demand per leave type as:

```
effectiveDays = EmployeeLeaveEntitlement.daysPerYear   (if override exists for this employee and leaveType)
              OR LeaveEntitlement.daysPerYear            (company-wide default)

balance = effectiveDays − sum(numberOfDays where status = 'approved' and year = currentYear and leaveTypeId matches)
```

Applies only to leave types where `isCapped` is `true`. Leave types with `isCapped: false` have no tracked balance.

---

## Leave Request Status Lifecycle

```
pending → manager_approved    (by Line Manager — first-stage approval)
pending → rejected            (by Line Manager — first-stage rejection)
manager_approved → approved   (by HR Admin — final approval)
manager_approved → rejected   (by HR Admin — final rejection)
pending → cancelled           (by Employee only, while status is pending)
```

HR Admin can modify or delete any leave request regardless of status.
Line Manager can only act on requests submitted by their direct reports (where `employee.lineManagerId = lineManager.employeeId`).
Employees may only transition `pending → cancelled`.

If an employee has no assigned Line Manager, leave requests go directly to HR Admin (skip the `manager_approved` stage): `pending → approved | rejected`.

---

## Authentication & Authorisation

- Firebase Authentication, email/password only.
- HR Admin creates user accounts and sets the initial password directly. 
- Employees and Line Managers can request a password reset email via Firebase Authentication's built-in reset flow (`sendPasswordResetEmail`). The reset link is sent to the user's registered email address.
- Roles stored as Firebase custom claims: `{ role: "admin" }`, `{ role: "manager" }`, or `{ role: "employee" }`. Set at account creation, never self-assigned.
- Express middleware verifies the Firebase ID token and reads the role claim on every request. No Firestore lookup per request.
- Known limitation: role changes require a token refresh before taking effect. Acceptable because roles are set once and rarely change.
- React never accesses Firestore directly. All reads/writes go through Express REST endpoints.

---

## Dashboards

Read-only aggregations over existing data. No new entities.

**HR Admin dashboard**: total active headcount, count of leave requests with status `manager_approved` (awaiting final approval), count of draft payslips not yet published.

**Line Manager dashboard**: count of pending leave requests from direct reports awaiting first-stage review.

**Employee dashboard**: leave balance summary (capped leave types, remaining days), list of own pending leave requests, status of latest payslip.

---

## Out of Scope (Future Enhancements)

- Profile photo upload
- Mobile responsiveness
