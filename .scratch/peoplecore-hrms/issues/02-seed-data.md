# 02 — Seed Data

**What to build:** An idempotent seed routine (either a startup script or an HR Admin-only `POST /seed` endpoint) that populates the three default leave types and their company-wide entitlements. This is the prerequisite data that leave submission and balance calculation depend on.

**Blocked by:** 01 — Scaffold, Auth, and Audit Infrastructure

**Status:** ready-for-agent

- [ ] Creates LeaveType document: `Annual` (`isCapped: true`, `defaultDaysPerYear: 14`)
- [ ] Creates LeaveType document: `Medical` (`isCapped: true`, `defaultDaysPerYear: 14`)
- [ ] Creates LeaveType document: `Unpaid` (`isCapped: false`)
- [ ] Creates LeaveEntitlement document for `Annual` (`daysPerYear: 14`)
- [ ] Creates LeaveEntitlement document for `Medical` (`daysPerYear: 14`)
- [ ] No LeaveEntitlement document is created for `Unpaid`
- [ ] Seed is idempotent — re-running does not create duplicate documents
- [ ] Restricted to HR Admin or server startup context; no unauthenticated access
- [ ] Tests: seed creates correct leave types and entitlements; re-run produces no duplicates; Unpaid has no LeaveEntitlement document
