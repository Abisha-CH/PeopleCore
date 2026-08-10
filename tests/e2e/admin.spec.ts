/**
 * Admin role — signed-in flow smoke tests.
 *
 * Verifies the admin can reach the dashboard, see their sidebar nav,
 * and access admin-only pages without being redirected.
 *
 * Every test signs in through the real login UI in a beforeEach (see
 * tests/e2e/helpers.ts). No storageState: Firebase v11 persists sessions
 * in IndexedDB (firebaseLocalStorageDb), which Playwright's storageState
 * cannot capture — so each test drives the real login form instead.
 */

import { test, expect } from "@playwright/test";
import { E2E_USERS } from "./config";
import { signInViaUI } from "./helpers";

test.describe("Admin dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await signInViaUI(page, E2E_USERS.admin);
  });

  test("dashboard renders with sidebar and page heading", async ({ page }) => {
    // signInViaUI lands on /dashboard with the shell already rendered.

    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible({ timeout: 15_000 });

    // Dashboard nav item should be present (highlighted in the sidebar).
    await expect(
      page.getByRole("link", { name: "Dashboard" }).first(),
    ).toBeVisible();

    // The page header greets the signed-in user (displayName).
    await expect(
      page.getByRole("heading", { name: /Welcome back/ }),
    ).toBeVisible();
  });

  test("admin sidebar contains all admin nav items", async ({ page }) => {
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav).toBeVisible({ timeout: 15_000 });

    for (const label of [
      "Dashboard",
      "Employees",
      "Leave Management",
      "Leave Settings",
      "Payroll",
      "Audit Log",
    ]) {
      await expect(nav.getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("sidebar shows the signed-in user's identity", async ({ page }) => {
    // The sidebar footer shows the account email of the signed-in user.
    await expect(page.getByText(E2E_USERS.admin.email)).toBeVisible();
  });
});

test.describe("Admin page access", () => {
  test.beforeEach(async ({ page }) => {
    await signInViaUI(page, E2E_USERS.admin);
  });

  const routes: Array<{ route: string; heading: string }> = [
    { route: "/employees", heading: "Employees" },
    { route: "/leave", heading: "Leave Management" },
    { route: "/leave-settings", heading: "Leave Settings" },
    { route: "/payroll", heading: "Payroll" },
    { route: "/audit-log", heading: "Audit Log" },
  ];

  for (const { route, heading } of routes) {
    test(`admin can reach ${route}`, async ({ page }) => {
      await page.goto(route);
      // Full reload: Firebase restores the session from IndexedDB, the shell
      // re-initializes, and the route must render without being bounced back
      // to /dashboard by the RoleGuard.
      await expect(page).toHaveURL(new RegExp(route), { timeout: 10_000 });
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    });
  }
});
