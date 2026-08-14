# PeopleCore

A web-based HR management system for companies with 100–200 employees. PeopleCore centralises **employee record management**, **leave management**, and **payroll** into a single role-controlled application.

This repository is a monorepo with two npm workspaces:

| Workspace | Directory | Purpose |
|---|---|---|
| `backend` | [`./backend`](./backend) | Express REST API + Firebase Admin SDK (Auth + Firestore) |
| `frontend` | [`./frontend`](./frontend) | React SPA (Vite) + Firebase Web SDK for authentication |

---

## Table of contents

- [Features](#features)
- [Tech stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Environment setup](#environment-setup)
  - [Backend (`backend/.env`)](#backend-backendenv)
  - [Frontend (`frontend/.env.local`)](#frontend-frontendenvlocal)
  - [Firebase console checklist](#firebase-console-checklist)
- [Installation](#installation)
- [Running the app](#running-the-app)
- [Testing, linting & building](#testing-linting--building)
- [Roles & permissions](#roles--permissions)
- [API overview](#api-overview)
- [Project structure](#project-structure)
- [Common tasks](#common-tasks)
- [Documentation](#documentation)

---

## Features

- **Employee management** — create, edit, and delete employee records; HR Admin only.
- **Leave management** — configurable leave types, company-wide entitlements, per-employee overrides, public holidays, and a multi-stage approval workflow (Line Manager → HR Admin).
- **Payroll** — payroll profiles per employee, monthly payslip generation with manual deductions, draft → published lifecycle.
- **Role-controlled access** — three roles (`admin`, `manager`, `employee`) enforced via Firebase custom claims.
- **Audit log** — every create/update/delete/status transition is recorded and only readable by HR Admin.

## Tech stack

| Layer | Technology |
|---|---|
| Backend | Node.js, Express 5, TypeScript, Firebase Admin SDK |
| Backend tests | Vitest + Supertest with an in-memory Firestore mock |
| Frontend | React 19, Vite 6, TypeScript, Tailwind CSS + shadcn/ui, TanStack Query, React Hook Form + Zod |
| Frontend tests | Vitest + Testing Library (jsdom) |
| Auth | Firebase Authentication (email/password only) |
| Database | Cloud Firestore |
| Monorepo | npm workspaces + `concurrently` |

> **Architecture note:** the React frontend never reads/writes Firestore directly. All data access goes through the Express REST API (see [docs/adr/0001-express-api-over-direct-firestore.md](./docs/adr/0001-express-api-over-direct-firestore.md)). Firebase Auth is the only Firebase client service the frontend touches.

## Prerequisites

- **Node.js ≥ 22** (the backend has been verified on Node 24)
- **npm ≥ 10**
- A **Firebase project** (free tier is fine) with **Authentication** and **Cloud Firestore** enabled

## Environment setup

Copy the example files and fill in your Firebase values. **Never commit real credentials** — the `.gitignore` already excludes `.env`, `.env.local`, and service account keys.

### Backend (`backend/.env`)

Start from the template:

```bash
cp backend/.env.example backend/.env
```

The backend loads this file via `dotenv/config` (default path is `.env`, read from the workspace root).

| Variable | Required | Description |
|---|---|---|
| `GOOGLE_APPLICATION_CREDENTIALS` | one of the two | Absolute path to the downloaded `serviceAccountKey.json` |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | one of the two | Alternative: paste the service-account JSON content inline (mutually exclusive with the above) |
| `FIREBASE_PROJECT_ID` | no | Falls back to the `project_id` from the service account, then to `GOOGLE_CLOUD_PROJECT`, then `peoplecore` |
| `PORT` | no | Server port, defaults to `4000` |

Get the service account from **Firebase Console → Project Settings → Service accounts → Generate new private key**, then save the JSON somewhere the backend can read. Example:

```bash
# backend/.env
GOOGLE_APPLICATION_CREDENTIALS=C:\Users\you\PeopleCore\backend\serviceAccountKey.json
PORT=4000
```

### Frontend (`frontend/.env.local`)

Vite reads `.env.local` from the **frontend project root** (`frontend/`), not from `src/`. Start from the committed template:

```bash
cp frontend/.env.example frontend/.env.local
```

```bash
# frontend/.env.local
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_API_BASE_URL=/api
```

Get these values from **Firebase Console → Project Settings → General → Your apps → Web app** (the SDK configuration block).

| Variable | Required | Notes |
|---|---|---|
| `VITE_FIREBASE_API_KEY` | ✅ | Needed for the SDK to boot |
| `VITE_FIREBASE_AUTH_DOMAIN` | ✅ | Usually `<project-id>.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | ✅ | **Must match the backend's project** |
| `VITE_FIREBASE_STORAGE_BUCKET` | no | Only if storage is used (the app does not currently use it) |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | no | |
| `VITE_FIREBASE_APP_ID` | no | |
| `VITE_API_BASE_URL` | no | Defaults to `/api`. In dev this is proxied by Vite to the backend |

### Firebase console checklist

- **Authentication → Sign-in method:** enable the **Email/Password** provider. There is no self-registration — HR Admins create accounts, so a sign-up page is intentionally absent.
- **Authentication → Templates → Password reset:** set the action URL to your app origin and add it to **Authorized domains** so the reset link opens your app.
- **Authentication → Authorized domains:** add `localhost` and your deployed domain.
- **Firestore:** create the database (production or test mode). See [Common tasks](#common-tasks) for the initial seed.

## Installation

From the repository root:

```bash
npm install
```

This installs the workspace dependencies. Alternatively `npm install --workspace=backend` / `--workspace=frontend` for a single app.

## Running the app

| Command | Runs |
|---|---|
| `npm run dev` | **Both** apps concurrently |
| `npm run dev:backend` | Backend only (Express, port `4000`) |
| `npm run dev:frontend` | Frontend only (Vite, port `5173`) |

- Frontend: <http://localhost:5173>
- Backend health check: <http://localhost:4000/api/health>

In dev, Vite proxies `/api/*` to `http://localhost:4000` (see `frontend/vite.config.ts`), so the frontend calls the backend with no CORS friction.

## Testing, linting & building

Run everything from the repository root:

| Command | Description |
|---|---|
| `npm run typecheck` | TypeScript across both workspaces |
| `npm run lint` | ESLint across both workspaces |
| `npm test` | Vitest across both workspaces |
| `npm run build` | Production build of both workspaces |

Per-workspace variants exist for each (`test:backend`, `build:frontend`, etc.). The backend suite (370 tests) runs against an in-memory Firestore mock, so no live Firebase connection is needed.

## Roles & permissions

Roles are stored as Firebase custom claims (`{ role: "admin" }`, `{ role: "manager" }`, or `{ role: "employee" }`), set at account creation and never self-assigned.

| Capability | Employee | Line Manager | HR Admin |
|---|---|---|---|
| View own profile, submit/cancel own leave, view own published payslips | ✅ | ✅ | ✅ |
| Edit own phone number | ✅ | ✅ | ✅ |
| First-stage approval of direct reports' leave | — | ✅ | — |
| Manage employee records, leave config, payroll, audit log | — | — | ✅ |
| Final approval of leave requests | — | — | ✅ |

Leave requests with no assigned Line Manager skip the first stage and go straight to HR Admin.

## API overview

All routes are prefixed `/api` and require a Firebase ID token (`Authorization: Bearer <token>`). Role restrictions are noted where they apply.

| Resource | Routes | Access |
|---|---|---|
| `/api/health` | `GET /` | Public |
| `/api/auth` | `POST /create-account` | Admin |
| `/api/employees` | CRUD + own-phone update | Mixed (see SRS) |
| `/api/seed` | Seed initial leave types & entitlements | Admin |
| `/api/leave-types` | CRUD (cascade removes entitlements atomically) | Admin |
| `/api/leave-entitlements` | CRUD | Admin |
| `/api/employee-leave-entitlements` | Per-employee overrides | Admin |
| `/api/public-holidays` | CRUD | Admin |
| `/api/leave-requests` | Submit, list, approve, reject, cancel | All roles, scoped |
| `/api/payroll-profiles` | CRUD | Admin (own profile readable by employee) |
| `/api/payslips` | Generate, edit draft, publish, delete, list | Admin; published payslips viewable by owner |
| `/api/audit-log` | List | Admin |
| `/api/dashboard` | Role-specific dashboards | All roles |

The authoritative requirements are in [docs/SRS.md](./docs/SRS.md). A complete domain glossary (every entity and its fields) lives in [CONTEXT.md](./CONTEXT.md).

## Project structure

```
PeopleCore/
├── backend/
│   ├── src/
│   │   ├── config/firebase.ts   # Firebase Admin init (service account)
│   │   ├── routes/              # Express routers (one per resource)
│   │   ├── services/            # Business logic + provisioning
│   │   ├── lib/                 # Validation, types, helpers
│   │   ├── middleware/          # Auth, audit, error handling
│   │   └── scripts/create-admin.ts  # Bootstrap the first admin account
│   ├── test/                    # Vitest + Supertest + Firestore mock
│   └── .env.example             # Backend env template
├── frontend/
│   ├── src/
│   │   ├── components/          # UI, auth, layout components
│   │   ├── providers/           # Auth context (Firebase Web SDK)
│   │   ├── lib/                 # firebase.ts, api.ts, auth helpers
│   │   ├── pages/               # Route-level pages
│   │   └── routes/              # React Router definition
│   └── vite.config.ts           # Dev server + /api proxy
├── docs/
│   ├── SRS.md                   # Software requirements specification
│   ├── adr/                     # Architecture decision records
│   └── agents/                  # Agent workflow documentation
├── CONTEXT.md                   # Domain glossary
├── PRODUCT.md                   # Product vision & design direction
└── package.json                 # npm workspaces root
```

## Common tasks

**Bootstrap the first HR Admin account** (requires a configured backend service account):

```bash
cd backend
EMAIL=admin@example.com PASSWORD='change-me' npx tsx src/scripts/create-admin.ts
```

**Seed the initial leave types** (`Annual`, `Medical`, `Unpaid`) and entitlements:

```bash
curl -X POST http://localhost:4000/api/seed \
  -H "Authorization: Bearer <admin-id-token>"
```

**Create an employee account** (HR Admin): `POST /api/employees` with the employee's details. The backend creates both the Firebase Auth account (with the appropriate custom claim) and the employee record. Passing `"role": "manager"` provisions a Line Manager; any value other than `employee`/`manager` is rejected.

## Documentation

| Document | What it covers |
|---|---|
| [CONTEXT.md](./CONTEXT.md) | Domain glossary: every entity, its fields, and business rules |
| [PRODUCT.md](./PRODUCT.md) | Product vision, users, and design direction |
| [docs/SRS.md](./docs/SRS.md) | Authoritative software requirements specification |
| [docs/adr/](./docs/adr/) | Architecture decision records |
| [CLAUDE.md](./CLAUDE.md) | Agent skills and workflow docs |
