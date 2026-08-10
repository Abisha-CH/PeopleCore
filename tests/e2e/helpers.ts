/**
 * Shared Playwright helpers for driving PeopleCore's real login UI.
 *
 * These helpers exercise the real login flow — no bypassed auth, no injected
 * tokens. They drive the same form a human would use.
 */

import { expect, type Page } from "@playwright/test";
import { E2E_USERS, ROLE_LABELS, type TestUser } from "./config";

/**
 * Drive the real login page to sign in as the given user.
 *
 * Steps:
 *   1. Navigate to /login
 *   2. Wait for the role selector (ensures setup-status has resolved)
 *   3. Click the matching role card
 *   4. Fill email + password
 *   5. Submit
 *   6. Wait for the page to navigate away from /login
 */
export async function signInViaUI(page: Page, user: TestUser): Promise<void> {
  await page.goto("/login");

  // Wait for the role selector to become visible (setup-status resolved).
  const roleSelector = page.getByRole("radiogroup", { name: "Sign in role" });
  await expect(roleSelector).toBeVisible({ timeout: 15_000 });

  // Select the role card. The radio accessible-name includes the role label
  // followed by the description, so we match with a trailing \s to be
  // specific without being fragile.
  const roleLabel = ROLE_LABELS[user.role];
  const roleRadio = page.getByRole("radio", {
    name: new RegExp(`^${escapeRegex(roleLabel)}\\s`),
  });
  await roleRadio.click();

  // Fill credentials (the FormLabel renders a proper <label> bound to the input).
  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);

  // Submit — button text is "Sign in as <Role Label>".
  const submitBtn = page.getByRole("button", {
    name: `Sign in as ${roleLabel}`,
  });
  await submitBtn.click();

  // After sign-in, the auth state listener should drive navigation to /dashboard.
  // If the app does not redirect this assertion will time out — surfacing
  // a genuine UX issue rather than silently working around it.
  await expect(page).toHaveURL(/\/dashboard/, { timeout: 15_000 });

  // Wait for the app shell (sidebar nav) to confirm the session has hydrated.
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible({ timeout: 10_000 });
}

/** Escape special regex characters in a literal string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
