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
