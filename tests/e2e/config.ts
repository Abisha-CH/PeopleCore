/**
 * E2E test configuration — user credentials and shared constants.
 *
 * Users are provisioned by global-setup.ts using the Firebase Admin SDK
 * (the same path as backend/src/services/provisioning.ts). Each user has
 * a real Firebase Auth account with the correct role claim and a matching
 * Employee document in Firestore.
 */

export const BASE_URL = "http://localhost:5173";

export interface TestUser {
  email: string;
  password: string;
  role: "admin" | "manager" | "employee";
  fullName: string;
}

/**
 * Deterministic test accounts. The email domain (.test) is an IANA-reserved
 * TLD — never a real address. Passwords meet Firebase Auth's 6-char minimum.
 */
export const E2E_USERS = {
  admin: {
    email: "e2e.admin@peoplecore.test",
    password: "E2E-Admin-2024!",
    role: "admin",
    fullName: "E2E HR Admin",
  },
  manager: {
    email: "e2e.manager@peoplecore.test",
    password: "E2E-Manager-2024!",
    role: "manager",
    fullName: "E2E Line Manager",
  },
  employee: {
    email: "e2e.employee@peoplecore.test",
    password: "E2E-Employee-2024!",
    role: "employee",
    fullName: "E2E Employee",
  },
} as const satisfies Record<string, TestUser>;

/**
 * Human-readable role labels matching frontend/src/lib/auth.ts ROLE_LABELS.
 * Used to target the correct radio button on the login page.
 */
export const ROLE_LABELS: Record<string, string> = {
  admin: "HR Admin",
  manager: "Line Manager",
  employee: "Employee",
};
