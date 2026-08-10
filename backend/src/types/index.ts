export type Role = "admin" | "manager" | "employee";

export const ROLES: readonly Role[] = ["admin", "manager", "employee"] as const;

export function isValidRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v as Role);
}

export interface AuthContext {
  uid: string;
  email?: string;
  role: Role;
}

export interface AuditDraft {
  action: string;
  targetType: string;
  targetId: string;
  diff?: Record<string, { before: unknown; after: unknown }>;
}

export interface AuditLogEntry {
  auditLogId: string;
  actorId: string;
  actorRole: Role;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string | null;
  diff?: Record<string, { before: unknown; after: unknown }>;
}

// ---- Employee --------------------------------------------------------------

export type EmploymentRole = "full-time" | "part-time" | "contract";

export const EMPLOYMENT_ROLES: readonly EmploymentRole[] = [
  "full-time",
  "part-time",
  "contract",
] as const;

export type EmploymentStatus = "active" | "inactive";

export const EMPLOYMENT_STATUSES: readonly EmploymentStatus[] = [
  "active",
  "inactive",
] as const;

export interface EmergencyContact {
  name: string;
  phone: string;
  relationship: string;
}

export interface EmployeeRecord {
  employeeId: string;
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

// ---- Leave -----------------------------------------------------------------

export interface LeaveType {
  leaveTypeId: string;
  name: string;
  isCapped: boolean;
  defaultDaysPerYear: number;
}

export interface LeaveEntitlement {
  leaveTypeId: string;
  daysPerYear: number;
}

export interface EmployeeLeaveEntitlement {
  employeeId: string;
  leaveTypeId: string;
  daysPerYear: number;
}

export interface PublicHoliday {
  publicHolidayId: string;
  name: string;
  date: string;
  year: number;
}

export type LeaveRequestStatus =
  | "pending"
  | "manager_approved"
  | "approved"
  | "rejected"
  | "cancelled";

export type HalfDayPeriod = "morning" | "afternoon";

export const HALF_DAY_PERIODS: readonly HalfDayPeriod[] = [
  "morning",
  "afternoon",
] as const;

export const LEAVE_REQUEST_STATUSES: readonly LeaveRequestStatus[] = [
  "pending",
  "manager_approved",
  "approved",
  "rejected",
  "cancelled",
] as const;

export function isLeaveRequestStatus(v: unknown): v is LeaveRequestStatus {
  return (
    typeof v === "string" &&
    (LEAVE_REQUEST_STATUSES as readonly string[]).includes(v)
  );
}

export interface LeaveRequest {
  leaveRequestId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
  numberOfDays: number;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: string | null;
  managerId?: string;
  managerActionAt?: string | null;
  managerRejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string | null;
  rejectionReason?: string;
}

// ---- Payroll ---------------------------------------------------------------

export interface PayrollProfile {
  employeeId: string;
  bankAccountNumber: string;
  bankName: string;
  baseSalary: number;
  createdAt: string | null;
  updatedAt: string | null;
}

export type PayslipStatus = "draft" | "published";

export const PAYSLIP_STATUSES: readonly PayslipStatus[] = [
  "draft",
  "published",
] as const;

export function isPayslipStatus(v: unknown): v is PayslipStatus {
  return (
    typeof v === "string" &&
    (PAYSLIP_STATUSES as readonly string[]).includes(v)
  );
}

export interface PayslipDeduction {
  label: string;
  amount: number;
}

export interface Payslip {
  payslipId: string;
  employeeId: string;
  month: number;
  year: number;
  baseSalary: number;
  deductions: PayslipDeduction[];
  netSalary: number;
  generatedAt: string | null;
  status: PayslipStatus;
}

// ---- Dashboard -------------------------------------------------------------

export interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  balance: number;
}

// ---- Seed Data -------------------------------------------------------------

export const SEED_LEAVE_TYPES: readonly {
  id: string;
  name: string;
  isCapped: boolean;
  defaultDaysPerYear: number;
}[] = [
  { id: "annual", name: "Annual", isCapped: true, defaultDaysPerYear: 14 },
  { id: "medical", name: "Medical", isCapped: true, defaultDaysPerYear: 14 },
  { id: "unpaid", name: "Unpaid", isCapped: false, defaultDaysPerYear: 0 },
];

export const SEED_ENTITLEMENTS: readonly {
  leaveTypeId: string;
  daysPerYear: number;
}[] = [
  { leaveTypeId: "annual", daysPerYear: 14 },
  { leaveTypeId: "medical", daysPerYear: 14 },
];
