import { defineConfig, devices } from "@playwright/test";

/**
 * PeopleCore E2E configuration.
 *
 * Architecture note: the React SPA never talks to Firestore directly — all
 * data goes through the Express REST API. In dev the Vite server proxies
 * /api -> http://localhost:4000, so a single webServer command (`npm run dev`)
 * that starts both workspaces via concurrently is the correct setup.
 *
 * Auth strategy (see docs/adr/0001): Firebase Authentication email/password
 * with roles enforced via custom claims. Test users are provisioned by
 * tests/e2e/global-setup.ts using the Firebase Admin SDK — the exact same
 * provisioning path as backend/src/services/provisioning.ts. Browsers sign
 * in through the real login page for every authenticated test (a beforeEach
 * in each spec drives the real UI). storageState is NOT used: Firebase v11's
 * default web persistence is indexedDBLocalPersistence, and Playwright's
 * storageState only captures cookies + localStorage — so a captured "session"
 * file would be empty. Per-test UI login is slower but tests the real flow
 * and requires no app changes and no auth bypass.
 *
 * Default behaviour:
 *   npm run test:e2e          — Chromium only (fast)
 *   npm run test:e2e:ui       — interactive mode
 *   npm run test:e2e:headed   — headed Chromium
 *   npm run test:e2e:all      — Chromium + Firefox + WebKit
 */

const PORT = 5173;
const BASE_URL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/e2e",

  /* ── Web server ───────────────────────────────────────────────────────────
   * The Vite dev server (port 5173) proxies /api to the Express backend
   * (port 4000). Starting `npm run dev` boots both via concurrently.
   * reuseExistingServer lets developers keep their own dev servers running. */
  webServer: {
    command: "npm run dev",
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },

  /* Provision real Firebase Auth users + Employee records before all projects. */
  globalSetup: "./tests/e2e/global-setup.ts",

  /* ── Project settings ────────────────────────────────────────────────────── */
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  /* 1 retry locally so `trace: on-first-retry` captures traces; 2 on CI. */
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,

  /* ── Timeouts ────────────────────────────────────────────────────────────── */
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },

  /* ── Reporting ───────────────────────────────────────────────────────────── */
  reporter: [
    ["list"],
    ["html", { outputFolder: "playwright-report", open: "never" }],
  ],

  /* ── Shared options ──────────────────────────────────────────────────────── */
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  /* ── Projects ──────────────────────────────────────────────────────────────
   * Authenticated specs sign in through the real login UI in a beforeEach —
   * no storageState, no setup project. Run the same suite on all three
   * engines; `npm run test:e2e` targets Chromium for fast local dev. */
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
