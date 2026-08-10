import { AppError } from "../errors";
import type { PayslipDeduction } from "../types";

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

function validMonth(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 12
  ) {
    throw new AppError(400, "INVALID_MONTH", "month must be an integer 1-12.");
  }
  return value;
}

function validYear(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 2000) {
    throw new AppError(
      400,
      "INVALID_YEAR",
      "year must be an integer of 2000 or later.",
    );
  }
  return value;
}

export interface PayslipCreateInput {
  employeeId: string;
  month: number;
  year: number;
}

export function validatePayslipCreate(
  input: Record<string, unknown>,
): PayslipCreateInput {
  const employeeId = requiredString(
    input.employeeId,
    "INVALID_EMPLOYEE_ID",
    "employeeId is required.",
  );
  const month = validMonth(input.month);
  const year = validYear(input.year);
  return { employeeId, month, year };
}

function validDeductionAmount(value: unknown, index: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new AppError(
      400,
      "INVALID_DEDUCTION_AMOUNT",
      `deductions[${index}].amount must be a non-negative number.`,
    );
  }
  return value;
}

export function validatePayslipUpdate(input: Record<string, unknown>): {
  deductions: PayslipDeduction[];
} {
  if (!Array.isArray(input.deductions)) {
    throw new AppError(
      400,
      "INVALID_DEDUCTIONS",
      "deductions must be an array.",
    );
  }

  const deductions: PayslipDeduction[] = [];
  for (let i = 0; i < input.deductions.length; i++) {
    const item = input.deductions[i];
    if (item && typeof item === "object") {
      const obj = item as Record<string, unknown>;
      const label = requiredString(
        obj.label,
        "INVALID_DEDUCTION_LABEL",
        `deductions[${i}].label is required.`,
      );
      const amount = validDeductionAmount(obj.amount, i);
      deductions.push({ label, amount });
    } else {
      throw new AppError(
        400,
        "INVALID_DEDUCTIONS",
        `deductions[${i}] must be an object with label and amount.`,
      );
    }
  }

  return { deductions };
}
