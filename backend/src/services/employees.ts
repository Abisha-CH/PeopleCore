import { db } from "../config/firebase";
import { AppError } from "../errors";
import type {
  EmergencyContact,
  EmployeeRecord,
  EmploymentRole,
  EmploymentStatus,
} from "../types";

export function toEmployee(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): EmployeeRecord | null {
  const data = doc.data();
  if (!data) return null;

  return {
    employeeId: doc.id,
    fullName: data.fullName as string,
    email: data.email as string,
    phone: data.phone as string,
    department: data.department as string,
    jobTitle: data.jobTitle as string,
    employmentRole: data.employmentRole as EmploymentRole,
    startDate: data.startDate as string,
    status: data.status as EmploymentStatus,
    nationalId: data.nationalId as string,
    address: data.address as string,
    emergencyContact: data.emergencyContact as EmergencyContact | undefined,
    lineManagerId: data.lineManagerId as string | undefined,
  };
}

export async function fetchEmployee(id: string): Promise<EmployeeRecord> {
  const doc = await db.collection("employees").doc(id).get();
  if (!doc.exists) {
    throw new AppError(404, "NOT_FOUND", "Employee not found.");
  }
  const employee = toEmployee(doc);
  if (!employee) {
    throw new AppError(404, "NOT_FOUND", "Employee not found.");
  }
  return employee;
}

/* -------------------------------------------------------------------------- */
/* Line manager name resolution                                                */
/* -------------------------------------------------------------------------- */

/**
 * Build a `lineManagerId -> fullName` map from an already-fetched collection
 * snapshot. Manager records live in the same `employees` collection, so list
 * responses can resolve every line manager name from the snapshot they already
 * hold — zero extra reads (no N+1).
 */
export function buildEmployeeNameMap(
  docs: Array<{ id: string; data(): Record<string, unknown> | undefined }>,
): Map<string, string> {
  const names = new Map<string, string>();
  for (const doc of docs) {
    const data = doc.data();
    if (data && typeof data.fullName === "string") {
      names.set(doc.id, data.fullName);
    }
  }
  return names;
}

/**
 * Attach `lineManagerName` to each employee using the given name map. Records
 * without an assigned manager (or whose manager is missing from the map) keep
 * `lineManagerName` undefined — callers render a graceful fallback.
 */
export function attachLineManagerNames(
  employees: EmployeeRecord[],
  namesById: Map<string, string>,
): EmployeeRecord[] {
  return employees.map((employee) => {
    if (!employee.lineManagerId) return employee;
    const name = namesById.get(employee.lineManagerId);
    return name ? { ...employee, lineManagerName: name } : employee;
  });
}

/**
 * Resolve a single employee's line manager name (used by GET /employees/:id).
 * At most one extra read, and only when a line manager is actually assigned.
 * A broken reference (manager record deleted) degrades to `undefined` rather
 * than failing the whole request.
 */
export async function resolveLineManagerName(
  employee: EmployeeRecord,
): Promise<EmployeeRecord> {
  if (!employee.lineManagerId) return employee;
  try {
    const doc = await db
      .collection("employees")
      .doc(employee.lineManagerId)
      .get();
    const data = doc.data();
    if (data && typeof data.fullName === "string") {
      return { ...employee, lineManagerName: data.fullName };
    }
  } catch {
    /* keep employee, leave lineManagerName undefined */
  }
  return employee;
}
