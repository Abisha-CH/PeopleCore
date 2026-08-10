import { AppError } from "../errors";

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

function validBaseSalary(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new AppError(
      400,
      "INVALID_BASE_SALARY",
      "baseSalary must be a positive number.",
    );
  }
  return value;
}

// ---- public API -------------------------------------------------------------

export interface PayrollProfileInput {
  bankAccountNumber: string;
  bankName: string;
  baseSalary: number;
}

/**
 * Validates the three business fields of a PayrollProfile. Used by both create
 * and update — a PUT replaces all three fields (full-replace, mirroring the
 * employees/leave-types convention). `employeeId` is not part of the payload;
 * on create it is validated separately and on update it comes from the URL.
 */
export function validatePayrollProfileInput(
  input: Record<string, unknown>,
): PayrollProfileInput {
  return {
    bankAccountNumber: requiredString(
      input.bankAccountNumber,
      "INVALID_BANK_ACCOUNT_NUMBER",
      "bankAccountNumber is required.",
    ),
    bankName: requiredString(
      input.bankName,
      "INVALID_BANK_NAME",
      "bankName is required.",
    ),
    baseSalary: validBaseSalary(input.baseSalary),
  };
}

/**
 * Validates a create payload: the three business fields plus `employeeId`.
 */
export function validatePayrollProfileCreate(
  input: Record<string, unknown>,
): PayrollProfileInput & { employeeId: string } {
  const employeeId = requiredString(
    input.employeeId,
    "INVALID_EMPLOYEE_ID",
    "employeeId is required.",
  );
  return { employeeId, ...validatePayrollProfileInput(input) };
}
