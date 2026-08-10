import { AppError } from "../errors";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- internal helpers -------------------------------------------------------

function requiredString(
  value: unknown,
  code: string,
  message: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  return value.trim();
}

function validateDays(value: unknown, code: string, message: string): number {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value <= 0
  ) {
    throw new AppError(400, code, message);
  }
  return value;
}

// ---- public API -------------------------------------------------------------

export interface LeaveTypeInput {
  name: string;
  isCapped: boolean;
  defaultDaysPerYear: number;
}

/**
 * Validates and normalises input for both create and full update of a LeaveType.
 *
 * Rules:
 *  - `name` is required, non-empty.
 *  - `isCapped` is required and must be a boolean.
 *  - `defaultDaysPerYear` is optional; when present it must be a non-negative
 *    number. When `isCapped` is `true` it must be > 0. When `isCapped` is
 *    `false` it is forced to `0` (per LEAVE-03).
 */
export function validateLeaveTypeInput(
  input: Record<string, unknown>,
): LeaveTypeInput {
  const name = requiredString(
    input.name,
    "INVALID_NAME",
    "Leave type name is required.",
  );

  if (typeof input.isCapped !== "boolean") {
    throw new AppError(
      400,
      "INVALID_IS_CAPPED",
      "isCapped must be a boolean.",
    );
  }
  const isCapped: boolean = input.isCapped;

  let defaultDaysPerYear = 0;

  if (input.defaultDaysPerYear !== undefined && input.defaultDaysPerYear !== null) {
    if (
      typeof input.defaultDaysPerYear !== "number" ||
      !Number.isFinite(input.defaultDaysPerYear) ||
      input.defaultDaysPerYear < 0
    ) {
      throw new AppError(
        400,
        "INVALID_DEFAULT_DAYS",
        "defaultDaysPerYear must be a non-negative number.",
      );
    }
    defaultDaysPerYear = input.defaultDaysPerYear;
  }

  if (isCapped && defaultDaysPerYear <= 0) {
    throw new AppError(
      400,
      "INVALID_DEFAULT_DAYS",
      "A capped leave type must have a positive defaultDaysPerYear.",
    );
  }

  return {
    name,
    isCapped,
    defaultDaysPerYear: isCapped ? defaultDaysPerYear : 0,
  };
}

export interface EntitlementInput {
  daysPerYear: number;
}

export function validateEntitlementInput(
  input: Record<string, unknown>,
): EntitlementInput {
  return {
    daysPerYear: validateDays(
      input.daysPerYear,
      "INVALID_DAYS_PER_YEAR",
      "daysPerYear must be a positive number.",
    ),
  };
}

export interface OverrideInput {
  employeeId: string;
  leaveTypeId: string;
  daysPerYear: number;
}

export function validateOverrideInput(
  input: Record<string, unknown>,
): OverrideInput {
  return {
    employeeId: requiredString(
      input.employeeId,
      "INVALID_EMPLOYEE_ID",
      "employeeId is required.",
    ),
    leaveTypeId: requiredString(
      input.leaveTypeId,
      "INVALID_LEAVE_TYPE_ID",
      "leaveTypeId is required.",
    ),
    daysPerYear: validateDays(
      input.daysPerYear,
      "INVALID_DAYS_PER_YEAR",
      "daysPerYear must be a positive number.",
    ),
  };
}

export interface PublicHolidayInput {
  name: string;
  date: string;
}

export function validatePublicHolidayInput(
  input: Record<string, unknown>,
): PublicHolidayInput {
  const name = requiredString(
    input.name,
    "INVALID_NAME",
    "Public holiday name is required.",
  );

  if (typeof input.date !== "string" || !DATE_RE.test(input.date) || Number.isNaN(new Date(input.date).getTime())) {
    throw new AppError(
      400,
      "INVALID_DATE",
      "Date must be a valid YYYY-MM-DD date.",
    );
  }

  return { name, date: input.date };
}
