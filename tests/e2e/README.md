# PeopleCore E2E Tests

End-to-end tests for PeopleCore HRMS using **Playwright** against the real running application (Vite dev server + Express backend + Firebase Auth + Firestore).

## Architecture

```
Playwright browser → http://localhost:5173 (Vite)
                          ↓  /api proxy
                     http://localhost:4000 (Express)
                          ↓
                     Firebase Auth / Firestore (real project: peoplecore-8466b)
```

### Auth strategy

No fake auth, no mocked tokens, no bypassed authorization.

| Step | What happens | Where |
|---|---|---|
| **Provision** | Firebase Auth users + Employee documents created via Admin SDK | `global-setup.ts` (mirrors `backend/src/services/provisioning.ts`) |
| **Sign in** | Playwright drives the real login page UI — role selector → email → password → submit | `helpers.ts signInViaUI()` |
| **Per test** | Every authenticated spec signs in again in a `beforeEach`, then navigates to the route under test | `admin.spec.ts`, `access-control.spec.ts` |

Every step is real — the same flow a human user follows.

### Why no `storageState`?

Playwright's `storageState` only captures cookies and `localStorage`.
PeopleCore's frontend uses `getAuth()` from Firebase SDK **v11**, whose default
web persistence is `indexedDBLocalPersistence` — the signed-in session lives in
**IndexedDB** (`firebaseLocalStorageDb`), not localStorage. A captured
`storageState` file is therefore empty
(`{"cookies":[],"origins":[]}`) and replayed specs get no session.

The alternatives were rejected deliberately:
- **Forcing `browserLocalPersistence` in the app** would make the tests pass by
  changing application behaviour — against the project rule "do not modify
  application functionality just to make tests pass."
- **Seeding IndexedDB via `addInitScript`** is a hack that is fragile across
  Firebase versions and skirts the real auth flow.

Instead each authenticated test signs in through the real login UI in a
`beforeEach`. This is slower (~6–8 s per authenticated test) but every
authenticated test exercises the real login flow, needs no app changes, and
cannot drift from what real users experience.

### Bug found during bring-up

The first suite run failed: after a successful sign-in the app **never
navigated away from `/login`**. `login-page.tsx` carried a comment claiming
"the auth-state listener navigates the app to the dashboard," but
`AuthProvider`'s listener only calls `setUser`/`setRole` — nothing navigates.
Real users were stuck on the login form after authenticating. Fixed in
`frontend/src/components/auth/login-page.tsx`: `onLogin` now calls
`navigate("/dashboard", { replace: true })` after a successful sign-in with a
matching role (the role-mismatch branch still signs out and shows guidance
without navigating).

### Test users

| Role | Email | Full name |
|---|---|---|
| HR Admin | `e2e.admin@peoplecore.test` | E2E HR Admin |
| Line Manager | `e2e.manager@peoplecore.test` | E2E Line Manager |
| Employee | `e2e.employee@peoplecore.test` | E2E Employee |

Created automatically by `global-setup.ts`. The `.test` TLD is IANA-reserved.

## Prerequisites

- **Firebase project** with Authentication + Firestore enabled (already configured for `peoplecore-8466b`)
- **Service account key** at `backend/serviceAccountKey.json` (referenced in `backend/.env`)
- **Frontend env** at `frontend/.env.local` (VITE_FIREBASE_* vars)
- **Node.js ≥ 22**, npm ≥ 10

## Running

```bash
# Fast — Chromium only (default for development)
npm run test:e2e

# Interactive mode (Playwright UI)
npm run test:e2e:ui

# Headed mode (visible browser)
npm run test:e2e:headed

# All browsers (Chromium + Firefox + WebKit)
npm run test:e2e:all
```

### Web server

Playwright starts `npm run dev` automatically (backend + frontend via concurrently) and waits for `http://localhost:5173` to respond. If you already have a dev server running, it reuses it (non-CI only).

### Prerequisites before first run

1. Run `npm install` at the repo root
2. Ensure `backend/.env` has `GOOGLE_APPLICATION_CREDENTIALS` pointing to a valid service account
3. Ensure `frontend/.env.local` has the VITE_FIREBASE_* values
4. Run `npm run test:e2e`

## What is tested

| File | Scope |
|---|---|
| `login.spec.ts` | Unauthenticated flows: redirect to login, role selector, invalid credentials, role mismatch, go-back from login form, forgot password, setup redirect |
| `access-control.spec.ts` | RoleGuard: employee blocked from admin routes, manager blocked from admin-only routes, each role can access own pages |
| `admin.spec.ts` | Admin dashboard: sidebar nav renders, all admin links visible, sidebar shows signed-in identity, admin can reach all admin-only pages (asserting each page's real heading) |

## What remains untested

- **Manager/employee dashboard content** — role-specific dashboard data rendering
- **CRUD operations** — creating/editing employees, leave requests, payroll via the real UI
- **Form validation** — employee form, leave request form, payroll form
- **Dialog interactions** — detail dialogs, decision dialogs, confirmation dialogs
- **Pagination / search / filtering** — data-heavy table pages
- **Mobile viewport** — responsive layout behavior
- **Error states** — network failures, 401 session expiry, 403 forbidden
- **Audit log** — admin-only audit trail rendering
- **Command palette** — Cmd+K quick navigation

These are noted for future expansion. The current suite provides a solid foundation covering authentication, authorization, and role-based navigation — the three most critical E2E concerns.

## File structure

```
tests/e2e/
├── config.ts              # Test user definitions, shared constants
├── global-setup.ts        # Firebase Admin SDK user provisioning (runs once)
├── helpers.ts             # signInViaUI() helper (drives the real login form)
├── login.spec.ts          # Unauthenticated login flows
├── access-control.spec.ts # RoleGuard routing tests (employee/manager)
├── admin.spec.ts          # Admin signed-in smoke tests
└── README.md              # This file
```

## Key files modified

| File | Change |
|---|---|
| `playwright.config.ts` | Full rewrite: webServer, globalSetup, chromium/firefox/webkit projects, per-test UI login |
| `package.json` | Added `test:e2e`, `test:e2e:ui`, `test:e2e:headed`, `test:e2e:all` scripts |
| `.gitignore` | Playwright output dirs |
| `tests/example.spec.ts` | Removed (Playwright demo for playwright.dev) |
| `frontend/src/components/auth/login-page.tsx` | **Bug fix**: navigate to `/dashboard` after successful sign-in (users were stuck on `/login`) |
