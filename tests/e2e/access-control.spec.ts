/**
 * Role-based access control — verifies that the RoleGuard redirects
 * users to /dashboard when they attempt to access pages outside their
 * role scope.
 *
 * Every test signs in through the real login UI in a beforeEach (see
 * tests/e2e/helpers.ts) as the relevant role, then navigates to the
 * target route. No storageState — see tests/e2e/admin.spec.ts header
 * for why (Firebase v11 uses IndexedDB persistence).
 */

import { test, expect } from "@playwright/test";
import { E2E_USERS } from "./config";
import { signInViaUI } from "./helpers";

const ADMIN_ONLY_ROUTES = [
  "/employees",
  "/leave",
  "/leave-settings",
  "/payroll",
  "/audit-log",
];

/* ── Employee role ─────────────────────────────────────────────────────────── */

test.describe("Employee access control", () => {
  test.beforeEach(async ({ page }) => {
    await signInViaUI(page, E2E_USERS.employee);
  });

  for (const route of ADMIN_ONLY_ROUTES) {
    test(`employee is redirected from ${route} to /dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    });
  }

  test("employee can access their own pages", async ({ page }) => {
    await page.goto("/my-leave");
    await expect(page).toHaveURL(/\/my-leave/);

    await page.goto("/my-profile");
    await expect(page).toHaveURL(/\/my-profile/);
  });
});

/* ── Manager role ──────────────────────────────────────────────────────────── */

test.describe("Manager access control", () => {
  test.beforeEach(async ({ page }) => {
    await signInViaUI(page, E2E_USERS.manager);
  });

  for (const route of ADMIN_ONLY_ROUTES) {
    test(`manager is redirected from ${route} to /dashboard`, async ({
      page,
    }) => {
      await page.goto(route);
      await expect(page).toHaveURL(/\/dashboard/, { timeout: 10_000 });
    });
  }

  test("manager can access leave-approvals", async ({ page }) => {
    await page.goto("/leave-approvals");
    await expect(page).toHaveURL(/\/leave-approvals/);
  });
});
