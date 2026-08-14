/**
 * Frontend mirror of the backend domain contracts (backend/src/types).
 * Kept in sync manually — every field here matches what the Express API returns.
 */

export type Role = "admin" | "manager" | "employee";

export type EmploymentRole = "full-time" | "part-time" | "contract";

export type EmployeeStatus = "active" | "inactive";

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
  startDate: string; // YYYY-MM-DD
  status: EmployeeStatus;
  nationalId: string;
  address: string;
  emergencyContact?: EmergencyContact;
  lineManagerId?: string;
  /** Resolved by the API: fullName of the assigned line manager. */
  lineManagerName?: string;
}

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
  date: string; // YYYY-MM-DD
  year: number;
}

export type LeaveRequestStatus =
  | "pending"
  | "manager_approved"
  | "approved"
  | "rejected"
  | "cancelled";

export type HalfDayPeriod = "morning" | "afternoon";

export interface LeaveRequest {
  leaveRequestId: string;
  employeeId: string;
  leaveTypeId: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
  numberOfDays: number;
  reason: string;
  status: LeaveRequestStatus;
  submittedAt: string; // ISO timestamp
  managerId?: string;
  managerActionAt?: string;
  managerRejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
}

export interface LeaveBalance {
  leaveTypeId: string;
  name: string;
  balance: number;
}

export interface PayrollProfile {
  employeeId: string;
  bankAccountNumber: string;
  bankName: string;
  baseSalary: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface PayslipDeduction {
  /** Display label (e.g. "Income Tax", "Pension") */
  label: string;
  amount: number;
}

export type PayslipStatus = "draft" | "published";

export interface Payslip {
  payslipId: string;
  employeeId: string;
  month: number; // 1–12
  year: number;
  baseSalary: number;
  deductions: PayslipDeduction[];
  netSalary: number;
  generatedAt?: string;
  status: PayslipStatus;
}

export interface AuditLogEntry {
  auditLogId: string;
  actorId: string;
  actorRole: string;
  action: string;
  targetType: string;
  targetId: string;
  timestamp: string;
  diff?: Record<string, { before: unknown; after: unknown }>;
}

/* ---- Dashboard payloads ---- */

export interface AdminDashboard {
  activeHeadcount: number;
  managerApprovedLeaveCount: number;
  draftPayslipCount: number;
}

export interface ManagerDashboard {
  pendingDirectReportLeaveCount: number;
}

export interface EmployeeDashboard {
  leaveBalances: LeaveBalance[];
  pendingLeaveRequests: LeaveRequest[];
  latestPayslip: { month: number; year: number; status: PayslipStatus } | null;
}

/* ---- Request/response envelopes ---- */

export interface ListResponse {
  total: number;
}

export interface EmployeesResponse extends ListResponse {
  employees: EmployeeRecord[];
}

export interface LeaveTypesResponse extends ListResponse {
  leaveTypes: LeaveType[];
}

export interface LeaveRequestsResponse extends ListResponse {
  leaveRequests: LeaveRequest[];
}

export interface PublicHolidaysResponse extends ListResponse {
  publicHolidays: PublicHoliday[];
}

export interface OverridesResponse extends ListResponse {
  overrides: EmployeeLeaveEntitlement[];
}

export interface PayslipsResponse extends ListResponse {
  payslips: Payslip[];
}

export interface AuditLogResponse extends ListResponse {
  entries: AuditLogEntry[];
}
