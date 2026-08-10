# PeopleCore — QA, UX & UI Audit Report

**Audit date:** 2026-08-07
**Auditor:** Claude Code (automated audit agent)
**Scope:** Full-stack monorepo (`backend/` Express + Firebase, `frontend/` React SPA), all 10 phases.
**Branches/ref:** `master` @ working tree as of audit date.
**Method:** Static code review of every source file, execution of test / typecheck / lint / production-build pipelines, and HTTP probing of the running dev servers (backend `:4000`, frontend `:5174`). No browser automation was available in this environment, so **visual/interaction findings are code-derived (with exact file:line evidence), not screenshot-based** — see [Audit method & limits](#audit-method--limits).

---

## 1. Executive summary

| Metric | Result |
|---|---|
| Backend unit/integration tests | **350 / 350 pass** (11 suites) |
| Frontend component tests | **6 / 6 pass** (2 suites) |
| TypeScript typecheck | ✅ both workspaces |
| ESLint | ✅ 0 errors, 2 warnings (untyped `any` in `backend/test/provisioning.test.ts`) |
| Production build | ✅ both workspaces (frontend JS **699.9 kB** / **200.2 kB gzip**) |
| Backend `/api/health` | ✅ HTTP 200 `{"status":"ok"}` |
| Frontend SPA | ✅ HTTP 200, SPA fallback works |
| Feature pages implemented in frontend | **0 of 10** |

### The one finding that defines this product

> **CRITICAL — The frontend ships zero feature functionality.** All 10 business pages — Dashboard, Employees, Leave Management, Leave Settings, Payroll, Audit Log, Leave Approvals, My Leave, My Profile, My Payslips — render the same placeholder card reading *"This module ships in a later ticket. It will appear here once implemented."* (`frontend/src/pages/placeholder-pages.tsx:16–117`). The app a customer can log in to today contains **only** the authentication screens and the navigation shell. **The product is a scaffold, not a build.**

The backend is a different story: it is production-grade in intent — role-scoped access on every route, input validation with specific error codes, immutable audit logging, transactional payslip generation, and a 350-test suite against an in-memory Firestore mock. **The engineering gap is entirely on the frontend.**

### Overall score

| # | Phase | Score /10 | Weight |
|---|---|---|---|
| 1 | Functional QA | 5.5 | 25% |
| 2 | UX review | 4.0 | 15% |
| 3 | UI review | 6.5 | 10% |
| 4 | Responsiveness | 7.0 | 5% |
| 5 | Accessibility | 7.0 | 10% |
| 6 | Performance | 6.0 | 10% |
| 7 | Design polish | 6.5 | 5% |
| 8 | Consistency audit | 7.5 | 5% |
| 9 | Production readiness | 4.5 | 15% |
| | **Weighted total** | **5.7 / 10** | 100% |

**Verdict: NOT PRODUCTION READY.** Severity distribution of confirmed findings below.

| Severity | Count | Definition |
|---|---|---|
| P0 – Critical | 1 | Blocks the product from being usable |
| P1 – High | 6 | Serious; must be fixed before release |
| P2 – Medium | 7 | Noticeable defect / quality gap |
| P3 – Low / polish | 14 | Minor, fast-follow |

---

## 2. Findings register (all confirmed, with evidence)

> Every finding below was verified by reading the cited code. Findings are ordered by severity, then phase.

### P0

**F-01 · Frontend feature pages are placeholders (Functional / UX / whole product)**
All ten modules in `frontend/src/pages/placeholder-pages.tsx` return `<PlaceholderPage>` with the literal string `"This module ships in a later ticket. It will appear here once implemented."` (line 16–17). `frontend/src/routes/app-routes.tsx:7–47` maps every route to these stubs. The complete set of real UI files is: login, protected route, role guard, 404, app shell, sidebar, header, command palette, and 15 shadcn/ui primitives — nothing that operates on business data.
**Impact:** a customer cannot create an employee, submit leave, approve anything, view a payslip, or read the audit log. 0% of SRS UI requirements are delivered.
**Fix:** implement the 10 modules against the already-complete API; see §10 roadmap.

---

### P1

**F-02 · No HTTP security headers on the backend (Production Readiness)**
`backend/src/app.ts:17–45` mounts `cors()`, `express.json()`, routes, 404, and error handler — no `helmet` or equivalent. No `X-Content-Type-Options`, CSP, `X-Frame-Options`, `Referrer-Policy`, etc. An HR system holding PII (nationality, phone, salary, leave history) serves without these headers. The Vite dev server also emits none.
**Impact:** clickjacking surface, MIME-sniffing risk, no CSP on the SPA.
**Fix:** add `helmet` to the backend; configure CSP for the frontend origin.

**F-03 · CORS is wide open (Production Readiness)**
`backend/src/app.ts:21` — `app.use(cors())` with no origin allow-list. In production the token-bearing API would accept calls from any origin. Bearer-token auth reduces (but does not eliminate) the risk versus cookies.
**Fix:** restrict to the deployed frontend origin(s); keep dev permissive via env flag.

**F-04 · No CI/CD pipeline (Production Readiness)**
No `.github/`, no Dockerfile, no `firebase.json` / static-hosting config, no deploy scripts anywhere in the repo. `package.json` scripts cover dev/build/test/typecheck/lint but nothing gates them automatically. Every quality gate is manual.
**Impact:** no regression safety net; "works on my machine" risk; no release path.
**Fix:** add a CI job (typecheck + lint + both test suites + both builds) and a deploy step for the SPA + backend.

**F-05 · No structured logging / request tracing (Production Readiness)**
Backend logging is bare `console.error` (`backend/src/middleware/errors.ts:50`, `backend/src/routes/seed.ts:81,95`). No request logger (morgan/pino-http), no correlation IDs, no audit-aware log stream. An incident in a PII system cannot be reconstructed from logs, and there is nothing for an APM/alerts tool to hook into.
**Fix:** structured logger + a `requestId` middleware; log method/path/status/duration at info level, errors at error level.

**F-06 · Frontend has no React error boundary (Production Readiness / Functional)**
There is no `ErrorBoundary` component anywhere in `frontend/src` (full file listing confirmed). In React 19 a render-time throw in any future page unmounts the entire root to a blank screen — with no message, no recovery, no reload affordance. For a daily-use HR app this is a realistic "stuck white page" scenario.
**Fix:** add an error boundary above the routed outlet with a friendly retry UI and an error report hook.

**F-07 · API client cannot express the real data operations (Functional)**
`frontend/src/lib/api.ts` exposes only `get` and `post` (lines 52–56). The backend surface the feature pages must call includes `put`, `patch`, and `delete` for every resource (payslips, leave types, employees, profiles…). The client also has no request timeout / abort controller (a hung request spins forever) and no centralized 401 → sign-out handling.
**Fix:** add `put`/`patch`/`delete`, an `AbortController` timeout, and a single place that maps `ApiError` status 401 to an auth-expired redirect.

---

### P2

**F-08 · Mobile nav drawer is not accessible (Accessibility)**
`frontend/src/components/layout/sidebar.tsx:123–144`: the off-canvas drawer has no `role="dialog"`, no `aria-modal`, no focus trap, no Escape-to-close, and the background content is never made `inert`. Because the closed drawer is only translated off-screen (`-translate-x-full`), its nav links **remain focusable** for keyboard users when closed — a classic tab-into-hidden-content trap.
**Fix:** `inert` the `<aside>` when closed; add `role="dialog"` + focus trap + Escape handling + focus return to the menu toggle when open.

**F-09 · Unknown / missing role claims silently downgrade users (Functional)**
`frontend/src/providers/auth-provider.tsx:56` — `setRole(isValidRole(r) ? r : "employee")`. An HR Admin whose custom claim is temporarily unset (e.g., mis-provisioned account, claim TTL) is silently rendered as an Employee — they lose the entire admin nav and see an "Employee" badge, with no warning. Security-wise this downgrades in the safe direction, but it is a silent, hard-to-diagnose failure for a real admin.
**Fix:** treat "unexpected role" as an explicit auth-error state (logged-out + message) rather than a silent downgrade.

**F-10 · Audit-log listing is not truly paginated (Functional / Performance)**
`backend/src/routes/audit-log.ts:54` fetches the **entire** `auditLog` collection (`db.collection("auditLog").get()`), filters/sorts in memory, then `slice(0, limit)` (line 92). Worse, `total: entries.length` (line 94) is the **post-slice** count — a client cannot tell whether more pages exist. Every request pays for the whole collection; at 100–200 employees over a couple of years (every create/update/delete/status-transition is audited) that is thousands of documents per request.
**Fix:** paginate at the query layer (`orderBy("timestamp","desc").startAfter(...).limit(N)`); return a real `total` via a count query or cursor.

**F-11 · Money arithmetic is raw floats (Functional / Payroll)**
`backend/src/services/payslips.ts:60–66` — `computeNetSalary` returns `baseSalary - deductions.reduce(...)` unrounded. `100.5 - 10.1` yields `90.40000000000001` in IEEE 754 and can serialize as such. Payroll math must not accumulate float drift.
**Fix:** round to 2 decimals at compute time (and/or store integer cents). Same for `netSalary` produced at generation (`payslips.ts:78`).

**F-12 · Dark mode is wired but unimplemented (UI / Design polish)**
`frontend/src/index.css:4` declares `@custom-variant dark` but no `.dark` token values exist anywhere; `--primary`, surfaces, etc. are light-only. A customer toggling system dark mode gets an unthemed light app. Industry peers (Workday, Rippling, Zoho) all ship dark themes.
**Fix:** add a `.dark` token block (and a `next-themes`-style toggle), or remove the variant to avoid the impression it exists.

**F-13 · No preview / static-hosting path for the built SPA (Production Readiness)**
`npm run build` emits `frontend/dist/` but there is no `preview` script and no documented static-hosting config, and no way to smoke-test the production artifact locally.
**Fix:** add `vite preview` script and a host config (Firebase Hosting / Vercel / nginx).

**F-14 · Security/observability baseline gaps (Production Readiness)**
(a) No rate limiting on any route (`backend/src/app.ts`); admin-token endpoints (`create-account`, `seed`, all writes) are unthrottled. (b) No graceful shutdown / signal handling in `backend/src/index.ts`. (c) No `.env.example` for the frontend (README tells users to create the file by hand) — onboarding friction and drift risk.

---

### P3 (polish / minor — representative selection)

| ID | Finding | Evidence |
|---|---|---|
| F-15 | `toPayslip` / `toEntry` silently coerce malformed docs to `0`/`""` (masks corruption) | `backend/src/services/payslips.ts:24–40`, `backend/src/routes/audit-log.ts:25–42` |
| F-16 | O(n) full-collection scans in balance/overlap/holiday/list logic (documented as "acceptable at ≤200 employees", but grows unbounded) | `backend/src/services/leave-balances.ts:62`, `leave-requests.ts:96,126`, `payslips.ts:85` |
| F-17 | Audit `action` strings mix two conventions: `payslip.create` (dot) vs `seed.create_leave_type` (underscore) | `backend/src/routes/payslips.ts:100`, `backend/src/routes/seed.ts:76` |
| F-18 | 404 page renders outside the AppShell — a logged-in user on an unknown URL loses sidebar/header/navigation context | `frontend/src/pages/not-found-page.tsx` (standalone `min-h-screen`), route `*` in `app-routes.tsx:50` |
| F-19 | "Firebase is not configured" copy is duplicated with slightly different wording in two places | `frontend/src/components/auth/login-page.tsx:98–103`, `protected-route.tsx:11–20` |
| F-20 | Error-banner styling is copy-pasted (`border-red-200 bg-red-50`) instead of a shared Alert component | `login-page.tsx:146–150,204–208` |
| F-21 | Raw slate hex used in components instead of design tokens, so theming/dark-mode breaks — three different border greys in the shell alone (`border-slate-200`, `border-border`, `border-slate-100`) | `header.tsx:33,57`, `sidebar.tsx:38,53,99`, `login-page.tsx:95`, vs tokens in `index.css:50–51` |
| F-22 | No touch-size compliance: 32px (`h-8`) nav rows are under the 44px pointer-target guideline | `sidebar.tsx:70` |
| F-23 | Sidebar `<nav>` has no `aria-label` (unlabelled landmark vs the labelled breadcrumb nav) | `sidebar.tsx:52` |
| F-24 | API client lacks timeout/abort; future pages will spin indefinitely on hung requests | `frontend/src/lib/api.ts:20–50` |
| F-25 | No frontend `preview` script (production artifact never smoke-tested) | `package.json` scripts |
| F-26 | Audit-log `total` is page length, not true total (misleading for a future UI counter) | `backend/src/routes/audit-log.ts:94` |
| F-27 | No frontend `.env.example` committed | `frontend/` (none present) |
| F-28 | Login `autoFocus` on email is good, but no visible focus-visible styling audit possible beyond defaults; relies on Tailwind default ring | `login-page.tsx:119` |

---

## 3. Phase 1 — Functional QA

### What was verified to work (evidence-backed)
- **Full backend test suite: 350/350 pass** across 11 suites (`auth`, `dashboard`, `seed`, `provisioning`, `audit-log`, `payroll-profiles`, `employees`, `payslips`, `leave-requests`, `leave-config`, `health`) — run via `npm test` (see transcript).
- **Frontend: 6/6 pass** (`login-page` ×4, `protected-route` ×2).
- **Live HTTP probes:** `/api/health` → 200 `{"status":"ok"}`; SPA `/` and `/login` → 200 (Vite fallback).
- Backend behaviors confirmed in code:
  - Role-based access on every route (`requireAuth` + `requireRole` middleware).
  - Transactional payslip generation with deterministic doc IDs (`employeeId_YYYY-MM`) preventing duplicates (`payslips.ts:28–82`, `payslipDocId` line 47).
  - Idempotent, batch-write seed (`seed.ts:49–68`).
  - Cascade delete of leave types → entitlements atomically.
  - Half-day leave = 0.5 days; full-day count = weekdays minus public holidays, UTC-safe (`leave-requests.ts:12–37`).
  - Entitlement resolution: per-employee override wins over company default (`leave-requests.ts:60–81`).
  - Active statuses (`pending`/`manager_approved`/`approved`) count against allowance to prevent over-booking; `cancelled`/`rejected` don't.
  - Audit log on every create/update/delete/status transition.
  - Centralized error handler maps Firebase auth errors to clean codes (`errors.ts:38–48`).

### What is broken / missing
- **F-01** — no feature functionality in the frontend (P0). End-to-end workflows (create employee → assign manager → submit leave → approve → generate payslip → publish) are **impossible from the UI today**; they exist only as tested API calls.
- **F-07** — the frontend data layer can't even issue PUT/PATCH/DELETE, so it is unready for the features that must be built on it.
- **F-09** — silent role downgrade on malformed claims.
- **F-11, F-26** — float money math; misleading pagination totals.

**Phase score: 5.5/10.** The backend half of the system is excellent and well-tested; the delivered application is non-functional beyond login, which caps the score.

---

## 4. Phase 2 — UX review (real-user perspective)

**What's good**
- Login is genuinely pleasant: inline Zod validation, `onBlur` validation mode, friendly error copy ("Invalid email or password.", "Too many attempts…"), safe account-agnostic reset message ("If an account exists for that email, a reset link has been sent."), disabled + spinner submit state, full-width CTA, brand mark.
- Post-login shell is coherent: breadcrumbs, command palette (⌘K), identity + role badge, sign-out with icon.

**What a real daily user hits**
- **Every destination is a dead end** ("ships in a later ticket"). A customer trialing the product concludes it doesn't do anything.
- **No admin bootstrap in the product.** Seeding leave types/entitlements and creating the first admin require terminal + `curl` with a raw Firebase ID token (README "Common tasks"). A non-technical HR Admin cannot set the system up.
- **No empty-state or guidance surface for first-run data.** The `EmptyState` component is well-built but only used for placeholders/404.
- **No success/failure feedback beyond login.** No toasts on actions (Sonner `Toaster` is mounted in `App.tsx:19` but nothing emits to it yet).
- Breadcrumb root is hardcoded "Dashboard" (`header.tsx:50`) even when the user is elsewhere and their role's primary area is different — acceptable, but stale once features exist.

**Phase score: 4.0/10.** Solid foundations; the product delivers no value to its stated users.

---

## 5. Phase 3 — UI review (vs BambooHR / Rippling / Deel / Workday / Zoho)

**Benchmarks assessed** (from public product knowledge, not screenshots):
- Modern HR suites (BambooHR, Rippling, Deel) use a light slate/blue palette, 14px base text, 240px sidebar, dense data tables, and ⌘K command palettes.
- The design tokens here (blue `#2563eb` primary, slate neutrals, Inter, 0.5rem radius — `index.css:10–69`) land squarely in that idiom and are executed consistently in the shell.

**Strengths**
- Token-driven theme from a documented spec (`peoplecore_final_design_spec.md` referenced in `index.css:7`).
- 240px / 64px-rail / mobile-drawer sidebar is exactly the industry pattern.
- Self-hosted Inter via `@fontsource` (no third-party font dependency).
- Command palette, role badge, skip link, page-header and empty-state components are reusable and well-typed.

**Gaps vs peers**
- Only ~4 real surfaces exist (login, 404, shell, placeholder card) — the **bulk of an HRMS's visual surface (tables, forms, dashboards, charts, wizards) cannot be rated** because it doesn't exist.
- **No dark mode** (F-12) — peers ship it.
- **Token discipline is inconsistent** (F-21): several components hardcode `slate-*` hex instead of the CSS-variable tokens, which will make theming and dark mode visibly uneven later.
- No data-table density choices, no form grid, no wizard pattern exist to compare — a genuine unknown for the feature phase.

**Phase score: 6.5/10.** The design language is contemporary and coherent; there is not enough of the product built to score visual design of feature surfaces.

---

## 6. Phase 4 — Responsiveness

**Verified**
- Responsive shell is genuinely adaptive, not just a media-query shim:
  - `lg`–`xl` (1024–1279px): 64px icon rail with tooltips (`sidebar.tsx:27,148–156`).
  - `<1024px`: off-canvas drawer with backdrop and body-click to close (`sidebar.tsx:123–144`).
  - Header shows the menu toggle only on mobile; content capped at `max-w-screen-xl` (`app-shell.tsx:34`).
- `useMediaQuery` hook drives both breakpoints consistently.

**Findings**
- F-08: the mobile drawer's closed state is still focusable (a11y, see §7).
- F-22: 32px nav rows are thin for touch (44px guideline).
- Deeper responsiveness (data tables → cards, forms, dashboard grids on phones) is **untestable** — no such surfaces exist.

**Phase score: 7.0/10.** The shell is a good responsive implementation; feature surfaces are unbuilt.

---

## 7. Phase 5 — Accessibility

**Verified strengths (genuinely good)**
- **Skip link** → `#main-content` (`tabindex={-1}`) correctly wired (`app-shell.tsx:18,29–33`, `skip-link.tsx`).
- **Login form** is best-in-class for this codebase: labelled fields, `aria-invalid` propagated by shadcn `FormControl`, `input[aria-invalid]` visual ring (`index.css:151–153`), `role="alert"` on errors, `role="status"` on reset success, correct `autoComplete`, `autoFocus` on email.
- **Reduced motion** handled twice: global CSS (`index.css:138–147`) and `MotionConfig reducedMotion="user"` (`App.tsx:17`).
- `NavLink` provides `aria-current`; 404 and config-error screens are plain readable text.

**Findings (all confirmed)**
- **F-08 (P2):** mobile drawer has no dialog semantics / focus trap / Escape / inert background; closed drawer remains keyboard-focusable.
- **F-23 (P3):** sidebar `<nav>` unlabelled — with the labelled breadcrumb `<nav aria-label="Breadcrumb">`, landmarks are indistinguishable to screen-reader users.
- **F-22 (P3):** 32px nav touch targets under guideline.
- **F-06 (P1):** no error boundary → accessibility of failure states is non-existent (blank screen).

**Phase score: 7.0/10.** Strong foundation and an exemplary login form; the interactive shell has real gaps that a keyboard/screen-reader user will hit immediately.

---

## 8. Phase 6 — Performance

**Measured (from the audit run)**
- Production build: **699.9 kB minified / 200.2 kB gzip** for the frontend JS — Vite itself warns `>500 kB`. **This is the empty shell.** There is zero feature code, zero route lazy-loading (`app-routes.tsx` statically imports all pages), and the total will balloon into the 1.5–3 MB range once tables/forms/charts are added without code-splitting.
- CSS: 41.75 kB / 8.21 kB gzip — fine.
- No images, no third-party fonts, no analytics scripts — the only render cost today is React + Firebase + the component tree.

**Findings**
- F-24: no request timeout/abort in the API client → hung requests = infinite spinner.
- F-10/F-16: backend list endpoints do full-collection reads (linear growth).
- TanStack Query is configured (`lib/query-client.ts`) — good caching baseline for the feature phase, currently unused.

**Phase score: 6.0/10.** Nothing renders badly, but the architecture already exhibits the two classic SPA performance anti-patterns (giant single bundle, no code splitting) before a line of feature UI exists.

---

## 9. Phase 7 — Design polish

**Strengths**
- Cohesive token set: canvas `#f8fafc`, surfaces white, primary `#2563eb`, status colors (`success`, `warning`), input error ring, motion durations (`index.css:10–120`).
- Placeholder pages reuse the design's empty-state pattern inside a card — the *intent* of the design system is visible even where features are missing.
- Reusable `PageHeader` (title/description/actions) and `EmptyState` (icon/title/description/action) are well-considered.

**Findings**
- **F-21 (P3):** token discipline broken in places — raw `slate-200/300/100` borders and `slate-100` active backgrounds in `header.tsx`, `sidebar.tsx`, `login-page.tsx` instead of `border` / `bg-accent` / `text-muted-foreground`. The shell alone uses three different border greys; future dark theming will be visibly patchy.
- **F-12 (P2):** dark-mode variant declared but no dark tokens.
- **F-19/F-20 (P3):** duplicated config-error copy and copy-pasted error-banner styling.

**Phase score: 6.5/10.** Good design DNA, inconsistent execution.

---

## 10. Phase 8 — Consistency audit

**Consistent (good)**
- Backend pattern is uniform across every resource: `Router` + `requireAuth`/`requireRole` + `writeRoute` (audit + respond) + `AppError` + centralized error handler. Impressive discipline.
- Frontend uses one component library (shadcn/ui), one icon set (lucide), one data-fetching baseline (TanStack Query).
- Error contract is consistent: `{ error: { code, message } }` everywhere on the backend.

**Inconsistent (minor but real)**
- F-17: audit `action` naming mixes `payslip.create` and `seed.create_leave_type` (dot vs underscore).
- F-18: 404 renders outside the AppShell — navigation context vanishes for logged-in users.
- F-19/F-20/F-21: duplicated copy/styling and raw-hex drift (see §9).
- F-26: `total` semantics inconsistent with what clients will reasonably assume.

**Phase score: 7.5/10.** The backend is a model of consistency; the frontend has duplication and token drift typical of an early scaffold.

---

## 11. Phase 9 — Production readiness

**What's ready**
- All 356 tests green; typecheck, lint, and production build all green (verified in this audit).
- No credentials committed (`.gitignore` excludes `.env*` / service-account keys — verified).
- Input validation on every write path; role enforcement server-side on every route.
- Health endpoint; centralized error mapping; transactional idempotent writes.
- Firestore data model is sound (deterministic payslip IDs, entitlement-override hierarchy, immutable audit).

**What's missing (all confirmed)**
- **F-02** security headers absent. **F-03** CORS open. **F-04** no CI/CD. **F-05** no structured logging. **F-06** no error boundary. **F-07** data layer incomplete. **F-10** audit pagination unbounded. **F-13** no preview/hosting path. **F-14** no rate limiting, no graceful shutdown, no frontend `.env.example`.
- No end-to-end test suite (no Playwright/Cypress) — unit/component coverage only.
- No audit-log retention or PII policy in code or docs; the log grows indefinitely.

**Phase score: 4.5/10.** Backend engineering is release-adjacent; the delivery pipeline, hardening, observability, and — decisively — the frontend feature surface are not.

---

## 12. Phase 10 — Requirements traceability (SRS)

The SRS (`docs/SRS.md`) defines requirements across AUTH, DASH, EMP, LEAVE, PAY, AUDIT, PERF, SEC, USE, REL.

| Area | Backend | Frontend |
|---|---|---|
| AUTH (login, password reset, role claims) | ✅ full | ✅ login/reset implemented |
| DASH (role-specific dashboards) | ✅ full, tested | ❌ placeholder |
| EMP (employee CRUD, own-phone edit, line-manager validation) | ✅ full, tested | ❌ placeholder |
| LEAVE (types, entitlements, overrides, holidays, requests, approvals, cancellation) | ✅ full, tested | ❌ all placeholders |
| PAY (profiles, payslip lifecycle, deductions, publish) | ✅ full, tested | ❌ all placeholders |
| AUDIT (immutable log, admin-only reads) | ✅ full | ❌ placeholder |
| PERF / SEC / REL | ⚠️ partial (see F-02…F-05, F-14) | ❌ n/a (no features) |
| USE (usability, a11y, responsive) | n/a | ⚠️ shell only |

**Read: the backend meets nearly the whole SRS; the frontend meets only AUTH + shell.**

---

## 13. Audit method & limits

**Executed this session**
1. Static review of every backend source file (routes, services, middleware, lib, types, config) and every frontend source file (components, providers, lib, pages, routes, hooks, styles, config).
2. `npm test` → 356/356 pass (transcript captured: frontend 6, backend 350).
3. `npm run typecheck` → clean both workspaces.
4. `npm run lint` → clean (warnings only; captured in §6.6 of run output).
5. `npm run build` → clean; bundle sizes captured.
6. Dev servers started; backend `/api/health` 200, SPA `/` and `/login` 200 verified via HTTP probes. (Note: port 5173 was already occupied, so the frontend bound 5174.)
7. No live Firebase credentials were exercised — the end-to-end authenticated API flows were validated via the 350-test suite and code review, not a live login.

**Limits**
- No browser automation tool was available, so **no screenshots** were captured and interaction-level bugs (clicking, tabbing in a real browser) were assessed from code. Every UI finding is anchored to a specific file/line so it can be reproduced.
- Visual design comparison to BambooHR/Rippling/Deel/Workday/Zoho is based on documented knowledge of those products, not live A/B screenshots.

---

## 14. Recommended remediation roadmap

| Order | Work | Clears |
|---|---|---|
| 1 | Ship the 10 feature modules against the existing API (employees → leave → payroll → audit), using the shell's components + TanStack Query. | F-01 |
| 2 | Add `put/patch/delete` + timeout + 401-handling to the API client. | F-07, F-24 |
| 3 | Error boundary above the routed outlet. | F-06 |
| 4 | Harden backend: `helmet`, origin allow-list for CORS, rate limiter, structured logging, graceful shutdown. | F-02, F-03, F-14, F-05 |
| 5 | True pagination on audit-log (and future list endpoints) at the query layer. | F-10, F-26 |
| 6 | Round money to cents in payslip math. | F-11 |
| 7 | Fix mobile drawer a11y (inert/focus trap/Escape/return-focus), label the sidebar nav, raise touch targets to ≥44px. | F-08, F-23, F-22 |
| 8 | CI pipeline (typecheck+lint+test+build) + preview script + static-hosting config. | F-04, F-13 |
| 9 | Explicit handling for unrecognized role claims instead of silent downgrade. | F-09 |
| 10 | Token hygiene (replace raw `slate-*`), dark-mode tokens, shared Alert + config-error components, 404 inside the shell, `.env.example`. | F-12, F-18–F-21, F-25, F-27 |

---

*Report generated by Claude Code. Findings are reproducible from the cited source locations. Scores reflect the application as delivered on 2026-08-07.*
