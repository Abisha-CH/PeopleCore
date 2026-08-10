/**
 * Login page — unauthenticated flows.
 *
 * These tests run WITHOUT storageState (no prior sign-in). They exercise
 * the login page itself: role selection, invalid credentials, wrong-role
 * mismatch, and the not-logged-in redirect.
 */

import { test, expect } from "@playwright/test";
import { E2E_USERS, ROLE_LABELS } from "./config";

test.describe("Login page (unauthenticated)", () => {
  test("redirects unauthenticated user from protected route to /login", async ({
    page,
  }) => {
    await page.goto("/dashboard");

    // ProtectedRoute redirects to /login with a location state.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });

    // The role selector should be visible (workspace is bootstrapped).
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("shows role selector when workspace is bootstrapped", async ({
    page,
  }) => {
    await page.goto("/login");

    const selector = page.getByRole("radiogroup", { name: "Sign in role" });
    await expect(selector).toBeVisible({ timeout: 15_000 });

    // All three role cards should be present.
    await expect(page.getByRole("radio", { name: /HR Admin\s/ })).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Line Manager\s/ }),
    ).toBeVisible();
    await expect(
      page.getByRole("radio", { name: /Employee\s+Request/ }),
    ).toBeVisible();
  });

  test("shows inline error for invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 15_000 });

    // Select Admin role
    await page.getByRole("radio", { name: /HR Admin\s/ }).click();

    // Fill invalid credentials
    await page.getByLabel("Email").fill("nonexistent@peoplecore.test");
    await page.getByLabel("Password").fill("WrongPassword123!");
    await page
      .getByRole("button", { name: "Sign in as HR Admin" })
      .click();

    // Expect the inline error alert
    await expect(
      page.getByRole("alert").filter({ hasText: /invalid email or password/i }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("role mismatch shows correct-role guidance", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 15_000 });

    // Select Employee role but try to sign in with admin credentials
    await page.getByRole("radio", { name: /Employee\s+Request/ }).click();
    await page.getByLabel("Email").fill(E2E_USERS.admin.email);
    await page.getByLabel("Password").fill(E2E_USERS.admin.password);
    await page
      .getByRole("button", { name: "Sign in as Employee" })
      .click();

    // The page should show the role-mismatch error
    await expect(
      page
        .getByRole("alert")
        .filter({ hasText: /registered as HR Admin/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("can go back from login form to role selector", async ({ page }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 15_000 });

    // Select a role to advance to the credentials form
    await page.getByRole("radio", { name: /HR Admin\s/ }).click();
    await expect(page.getByLabel("Email")).toBeVisible();

    // Fill a valid email first: the Email input has autoFocus and the form uses
    // mode="onBlur" validation. Clicking "Change role" blurs Email mid-click,
    // and the resulting "invalid email" validation update races with the role
    // reset, leaving the form stuck. A valid value avoids the race.
    await page.getByLabel("Email").fill("test@peoplecore.test");

    // Click "Change role" to go back
    await page.getByRole("button", { name: "Change role" }).click();

    // Role selector is visible again
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 10_000 });
  });

  test("forgot password form is reachable and returns to login", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(
      page.getByRole("radiogroup", { name: "Sign in role" }),
    ).toBeVisible({ timeout: 15_000 });

    await page.getByRole("radio", { name: /HR Admin\s/ }).click();
    await page.getByLabel("Email").fill(E2E_USERS.admin.email);

    // Switch to forgot-password mode
    await page.getByRole("button", { name: "Forgot password?" }).click();
    await expect(
      page.getByRole("button", { name: "Send Reset Link" }),
    ).toBeVisible();

    // Switch back
    await page.getByRole("button", { name: "Back to login" }).click();
    await expect(
      page.getByRole("button", { name: /Sign in as/ }),
    ).toBeVisible();
  });

  test("navigating to /setup when bootstrapped redirects to /login", async ({
    page,
  }) => {
    await page.goto("/setup");
    // SetupPage redirects to /login when workspace is already bootstrapped.
    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
  });
});
