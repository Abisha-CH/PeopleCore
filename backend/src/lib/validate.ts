import { isValidRole, type Role } from "../types";
import { AppError } from "../errors";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface CreateAccountInput {
  email: string;
  password: string;
  role: Role;
  displayName?: string;
}

export interface SetupInput {
  fullName: string;
  email: string;
  password: string;
}

/**
 * Validates the first-run workspace bootstrap payload. The password threshold
 * mirrors WEAK_PASSWORD elsewhere (6 chars) so the setup form behaves like
 * every other account-creation flow.
 */
export function validateSetup(input: Record<string, unknown>): SetupInput {
  const { fullName, email, password } = input;

  if (typeof fullName !== "string" || fullName.trim().length < 2) {
    throw new AppError(400, "INVALID_FULL_NAME", "Enter your full name.");
  }

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  if (typeof password !== "string" || password.length < 6) {
    throw new AppError(
      400,
      "WEAK_PASSWORD",
      "Password must be at least 6 characters.",
    );
  }

  return {
    fullName: fullName.trim(),
    email: email.trim(),
    password,
  };
}

export function validateCreateAccount(
  input: Record<string, unknown>,
): CreateAccountInput {
  const { email, password, role, displayName } = input;

  if (typeof email !== "string" || !EMAIL_RE.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }

  if (typeof password !== "string" || password.length < 6) {
    throw new AppError(
      400,
      "WEAK_PASSWORD",
      "Password must be at least 6 characters.",
    );
  }

  if (typeof role !== "string" || !isValidRole(role)) {
    throw new AppError(
      400,
      "INVALID_ROLE",
      "Role must be one of: admin, manager, employee.",
    );
  }

  if (
    displayName !== undefined &&
    (typeof displayName !== "string" || displayName.trim().length === 0)
  ) {
    throw new AppError(
      400,
      "INVALID_DISPLAY_NAME",
      "Display name must be a non-empty string.",
    );
  }

  return {
    email: email.trim(),
    password,
    role: role,
    displayName:
      typeof displayName === "string" ? displayName.trim() : undefined,
  };
}
