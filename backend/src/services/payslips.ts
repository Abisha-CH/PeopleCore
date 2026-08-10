import { db } from "../config/firebase";
import { AppError } from "../errors";
import type { Payslip, PayslipDeduction } from "../types";

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

export function toPayslip(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): Payslip | null {
  const data = doc.data();
  if (!data) return null;

  return {
    payslipId: doc.id,
    employeeId: (data.employeeId as string) ?? "",
    month: (data.month as number) ?? 0,
    year: (data.year as number) ?? 0,
    baseSalary: (data.baseSalary as number) ?? 0,
    deductions: Array.isArray(data.deductions)
      ? (data.deductions as PayslipDeduction[])
      : [],
    netSalary: (data.netSalary as number) ?? 0,
    generatedAt: toIso(data.generatedAt),
    status: (data.status as Payslip["status"]) ?? "draft",
  };
}

/**
 * Deterministic payslip document ID. The doc lives in the subcollection
 * `/payrollProfiles/{employeeId}/payslips/{payslipId}`, so this ID guarantees
 * exactly one payslip per employee/month/year at the storage layer.
 */
export function payslipDocId(
  employeeId: string,
  year: number,
  month: number,
): string {
  return `${employeeId}_${year}-${String(month).padStart(2, "0")}`;
}

/**
 * The payslip's own snapshot of baseSalary minus its deductions. Computed from
 * the stored snapshot (never from the live PayrollProfile), so a later salary
 * change can never retroactively alter a historical payslip.
 */
export function computeNetSalary(
  baseSalary: number,
  deductions: PayslipDeduction[],
): number {
  const total = deductions.reduce((sum, d) => sum + d.amount, 0);
  return baseSalary - total;
}

export async function fetchPayslip(payslipId: string): Promise<Payslip> {
  // The payslip doc ID equals payslipId (see payslipDocId). We iterate
  // each payroll profile's subcollection and read the specific doc directly.
  // This avoids a collectionGroup WHERE query which would require a
  // COLLECTION_GROUP_ASC index on payslipId — a manual index that is
  // error-prone to set up and cannot be auto-created by Firestore.
  const profiles = await db.collection("payrollProfiles").listDocuments();
  for (const ref of profiles) {
    const doc = await ref.collection("payslips").doc(payslipId).get();
    if (doc.exists) {
      const payslip = toPayslip({
        id: doc.id,
        data: () => doc.data(),
      } as { id: string; data(): Record<string, unknown> | undefined });
      if (payslip) return payslip;
    }
  }
  throw new AppError(404, "NOT_FOUND", "Payslip not found.");
}

export async function fetchAllPayslips(): Promise<Payslip[]> {
  const snap = await db.collectionGroup("payslips").get();
  return snap.docs
    .map((d) => toPayslip(d))
    .filter((p): p is Payslip => p !== null);
}
