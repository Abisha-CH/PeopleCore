import { db } from "../config/firebase";
import { AppError } from "../errors";
import type { PayrollProfile } from "../types";

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.toDate === "function") {
      return (obj.toDate as () => Date)().toISOString();
    }
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

export function toPayrollProfile(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): PayrollProfile | null {
  const data = doc.data();
  if (!data) return null;

  return {
    employeeId: doc.id,
    bankAccountNumber: (data.bankAccountNumber as string) ?? "",
    bankName: (data.bankName as string) ?? "",
    baseSalary: (data.baseSalary as number) ?? 0,
    createdAt: toIso(data.createdAt),
    updatedAt: toIso(data.updatedAt),
  };
}

export async function fetchPayrollProfile(
  employeeId: string,
): Promise<PayrollProfile> {
  const doc = await db.collection("payrollProfiles").doc(employeeId).get();
  if (!doc.exists) {
    throw new AppError(
      404,
      "NOT_FOUND",
      "No payroll profile exists for this employee.",
    );
  }
  const profile = toPayrollProfile(doc);
  if (!profile) {
    throw new AppError(
      404,
      "NOT_FOUND",
      "No payroll profile exists for this employee.",
    );
  }
  return profile;
}

/**
 * Field-level diff for the audit trail. Only the business fields are compared:
 * `employeeId` is identity (never changes) and `createdAt`/`updatedAt` are
 * system timestamps, so they are excluded from the diff. This keeps the audit
 * output focused on what HR Admin actually changed.
 */
export function computeDiff(
  before: PayrollProfile,
  after: PayrollProfile,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of ["bankAccountNumber", "bankName", "baseSalary"]) {
    const b = before[key as keyof PayrollProfile];
    const a = after[key as keyof PayrollProfile];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}
