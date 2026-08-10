# 06 — Leave Balance

**What to build:** On-demand leave balance computation endpoint. Uses per-employee entitlement override when set, otherwise falls back to company-wide default. Returns null for uncapped leave types. Never stored — always computed live.

**Blocked by:** 04 — Leave Configuration; 05 — Leave Submission and Listing

**Status:** ready-for-agent

- [ ] `GET /leave-balance?employeeId=:id&leaveTypeId=:id&year=:year`
- [ ] Formula: `effectiveDays − sum(numberOfDays where status = 'approved' and year = :year and leaveTypeId = :leaveTypeId)`
- [ ] `effectiveDays`: use EmployeeLeaveEntitlement override if present; otherwise use LeaveEntitlement company-wide default
- [ ] For `isCapped: false` leave types: return `{ balance: null }` — no balance tracked
- [ ] Zero balance: all entitlement days consumed — return `0`
- [ ] Negative balance: approved days exceed entitlement — return the negative value (not clamped); this is a valid state when HR Admin modifies entitlements after approvals
- [ ] Balance is not stored; computed fresh on every request
- [ ] Authorization: HR Admin may query any employee's balance; Employee may query only own balance (403 on another employee's); Line Manager may query only own balance (403 on a direct report's balance)
- [ ] Tests: company default path (no override); per-employee override path (override takes precedence); uncapped type returns `null`; half-day approved requests reduce balance by 0.5; public holidays correctly excluded (already stored in `numberOfDays` on approved requests); zero balance; negative balance; Employee cannot query another employee's balance (403); Line Manager cannot query a direct report's balance (403)
