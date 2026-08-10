import { AppError } from "../errors";
import {
  EMPLOYMENT_ROLES,
  EMPLOYMENT_STATUSES,
  type EmergencyContact,
  type EmploymentRole,
  type EmploymentStatus,
  type Role,
} from "../types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Roles that can be granted when provisioning a managed user via POST /employees. */
const CREATABLE_ROLES: readonly Role[] = ["employee", "manager"] as const;

export interface EmployeeBusinessInput {
  fullName: string;
  email: string;
  phone: string;
  department: string;
  jobTitle: string;
  employmentRole: EmploymentRole;
  startDate: string;
  status: EmploymentStatus;
  nationalId: string;
  address: string;
  emergencyContact?: EmergencyContact;
  lineManagerId?: string;
}

export interface EmployeeCreateInput extends EmployeeBusinessInput {
  password: string;
  /** Firebase claim role to grant this user. Defaults to "employee". */
  role?: Role;
}

function requiredString(value: unknown, code: string, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  return value.trim();
}

function optionalString(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new AppError(400, "INVALID_FIELD", "Field must be a string.");
  }
  return value.trim();
}

function enumValue<T extends string>(
  value: unknown,
  allowed: readonly T[],
  code: string,
  message: string,
): T {
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) {
    throw new AppError(400, code, message);
  }
  return value as T;
}

function validateDate(value: unknown): string {
  const s = requiredString(value, "INVALID_START_DATE", "Start date is required.");
  if (!DATE_RE.test(s) || Number.isNaN(new Date(s).getTime())) {
    throw new AppError(
      400,
      "INVALID_START_DATE",
      "Start date must be a valid YYYY-MM-DD date.",
    );
  }
  return s;
}

function validateEmail(value: unknown): string {
  const s = requiredString(value, "INVALID_EMAIL", "Enter a valid email address.");
  if (!EMAIL_RE.test(s)) {
    throw new AppError(400, "INVALID_EMAIL", "Enter a valid email address.");
  }
  return s;
}

/**
 * Role is optional; when provided it must be a role that HR Admin is allowed to
 * provision (employee or manager). `admin` accounts are created via
 * POST /auth/create-account, not via employee provisioning.
 */
function validateEmployeeRole(value: unknown): Role | undefined {
  if (value === undefined || value === null) return undefined;
  if (
    typeof value !== "string" ||
    !(CREATABLE_ROLES as readonly string[]).includes(value)
  ) {
    throw new AppError(
      400,
      "INVALID_ROLE",
      "Role must be one of: employee, manager.",
    );
  }
  return value as Role;
}

function validateEmergencyContact(
  value: unknown,
): EmergencyContact | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new AppError(
      400,
      "INVALID_EMERGENCY_CONTACT",
      "Emergency contact must include name, phone, and relationship.",
    );
  }
  const o = value as Record<string, unknown>;
  if (
    typeof o.name !== "string" ||
    typeof o.phone !== "string" ||
    typeof o.relationship !== "string"
  ) {
    throw new AppError(
      400,
      "INVALID_EMERGENCY_CONTACT",
      "Emergency contact must include name, phone, and relationship.",
    );
  }
  return { name: o.name, phone: o.phone, relationship: o.relationship };
}

function businessFields(input: Record<string, unknown>): EmployeeBusinessInput {
  return {
    fullName: requiredString(
      input.fullName,
      "INVALID_FULL_NAME",
      "Full name is required.",
    ),
    email: validateEmail(input.email),
    phone: requiredString(input.phone, "INVALID_PHONE", "Phone number is required."),
    department: requiredString(
      input.department,
      "INVALID_DEPARTMENT",
      "Department is required.",
    ),
    jobTitle: requiredString(
      input.jobTitle,
      "INVALID_JOB_TITLE",
      "Job title is required.",
    ),
    employmentRole: enumValue(
      input.employmentRole,
      EMPLOYMENT_ROLES,
      "INVALID_EMPLOYMENT_ROLE",
      "Employment role must be one of: full-time, part-time, contract.",
    ),
    startDate: validateDate(input.startDate),
    status: enumValue(
      input.status,
      EMPLOYMENT_STATUSES,
      "INVALID_STATUS",
      "Status must be one of: active, inactive.",
    ),
    nationalId: requiredString(
      input.nationalId,
      "INVALID_NATIONAL_ID",
      "National ID is required.",
    ),
    address: requiredString(
      input.address,
      "INVALID_ADDRESS",
      "Address is required.",
    ),
    emergencyContact: validateEmergencyContact(input.emergencyContact),
    lineManagerId: optionalString(input.lineManagerId),
  };
}

export function validateEmployeeCreate(
  input: Record<string, unknown>,
): EmployeeCreateInput {
  const password = requiredString(
    input.password,
    "WEAK_PASSWORD",
    "Password must be at least 6 characters.",
  );
  if (password.length < 6) {
    throw new AppError(
      400,
      "WEAK_PASSWORD",
      "Password must be at least 6 characters.",
    );
  }
  const role = validateEmployeeRole(input.role);
  return { ...businessFields(input), password, role };
}

export function validateEmployeeUpdate(
  input: Record<string, unknown>,
): EmployeeBusinessInput {
  return businessFields(input);
}

export function validatePhoneUpdate(input: Record<string, unknown>): {
  phone: string;
} {
  return {
    phone: requiredString(input.phone, "INVALID_PHONE", "Phone number is required."),
  };
}
