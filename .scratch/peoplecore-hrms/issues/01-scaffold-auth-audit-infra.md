# 01 — Scaffold, Auth, and Audit Infrastructure

**What to build:** Bootstrap the Express application wired to Firebase Admin SDK. Implement token verification middleware (401 on invalid/missing token), role enforcement middleware (403 on wrong role), and an audit middleware that writes an AuditLog entry to Firestore after every successful write operation. Deliver `POST /auth/create-account` for account creation and the complete audit log read API (`GET /audit-log`, `GET /audit-log/:id`). Password reset uses client-side `sendPasswordResetEmail` — no backend endpoint required.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] Express app starts and connects to Firebase Admin SDK
- [ ] `POST /auth/create-account` creates a Firebase Auth user with role custom claim (`admin`, `manager`, or `employee`)
- [ ] Token verification middleware returns 401 on missing or invalid token
- [ ] Role enforcement middleware returns 403 when the authenticated role does not match the required role
- [ ] Role claims are set only by the backend; no client-side claim mutation is permitted
- [ ] `POST /auth/create-account` is restricted to HR Admin role
- [ ] Audit middleware writes an AuditLog entry to Firestore after every successful write, recording: `actorId`, `actorRole`, `action`, `targetType`, `targetId`, `timestamp`, `diff` (changed fields with before/after values, omitted for create/delete)
- [ ] `GET /audit-log` — HR Admin reads all audit log entries, filterable by `targetType`, `actorId`, and date range; ordered by `timestamp` descending
- [ ] `GET /audit-log/:id` — HR Admin reads a single audit log entry
- [ ] No PUT or DELETE endpoints exist for `/audit-log` — entries are immutable by design
- [ ] `GET /audit-log` and `GET /audit-log/:id` are restricted to HR Admin; Line Manager and Employee return 403
- [ ] Tests: account created with correct role claim; 401 on missing token; 403 on wrong role on a protected endpoint; audit entry written after a test write (correct fields present); HR Admin reads and filters audit log; Line Manager gets 403 on audit log; Employee gets 403 on audit log; PUT/DELETE on `/audit-log/:id` returns 404 or 405; entries contain all required fields (`actorId`, `actorRole`, `action`, `targetType`, `targetId`, `timestamp`, `diff`)
