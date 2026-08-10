import { db } from "../config/firebase";
import { fetchEmployee } from "./employees";
import { computeLeaveBalances } from "./leave-balances";
import { toPayslip } from "./payslips";
import type {
  AuthContext,
  LeaveBalance,
  LeaveRequest,
  Payslip,
  PayslipStatus,
} from "../types";

// ---- payload types ---------------------------------------------------------

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

export type DashboardPayload =
  | AdminDashboard
  | ManagerDashboard
  | EmployeeDashboard;

// ---- reusable counting helper ----------------------------------------------

type CountableQuery = {
  count?: () => { get(): Promise<{ data(): { count: number } }> };
  get(): Promise<{ size: number }>;
};

/**
 * Aggregation-aware document count. Uses the Firestore `count()` aggregation
 * query when the SDK/harness supports it; otherwise falls back to fetching the
 * matching documents and returning `snapshot.size`. Both paths return the same
 * number, and this is the only place that changes when `count()` becomes
 * available in the test harness — the route layer never knows which is used.
 */
export async function countDocs(query: CountableQuery): Promise<number> {
  if (typeof query.count === "function") {
    const snap = await query.count().get();
    return snap.data().count;
  }
  const snap = await query.get();
  return snap.size;
}

// ---- HR Admin --------------------------------------------------------------

/**
 * Count draft payslips across all profiles without a collectionGroup query.
 * A collectionGroup WHERE on a subcollection requires a manually-created
 * COLLECTION_GROUP_ASC index, which is fragile to set up. Instead we iterate
 * each profile's payslips subcollection — automatic single-field indexes
 * cover the `status` filter on the subcollection directly.
 */
async function countDraftPayslips(): Promise<number> {
  const profileRefs = await db.collection("payrollProfiles").listDocuments();
  let count = 0;
  for (const ref of profileRefs) {
    const snap = await ref
      .collection("payslips")
      .where("status", "==", "draft")
      .get();
    count += snap.size;
  }
  return count;
}

export async function computeAdminDashboard(): Promise<AdminDashboard> {
  const [activeHeadcount, managerApprovedLeaveCount, draftPayslipCount] =
    await Promise.all([
      countDocs(db.collection("employees").where("status", "==", "active")),
      countDocs(
        db
          .collection("leaveRequests")
          .where("status", "==", "manager_approved"),
      ),
      countDraftPayslips(),
    ]);
  return { activeHeadcount, managerApprovedLeaveCount, draftPayslipCount };
}

// ---- Line Manager ----------------------------------------------------------

async function fetchDirectReportIds(managerId: string): Promise<Set<string>> {
  const snap = await db
    .collection("employees")
    .where("lineManagerId", "==", managerId)
    .get();
  const ids = new Set<string>();
  for (const doc of snap.docs) ids.add(doc.id);
  return ids;
}

async function countPendingDirectReports(managerId: string): Promise<number> {
  const [directReports, pendingSnap] = await Promise.all([
    fetchDirectReportIds(managerId),
    db.collection("leaveRequests").where("status", "==", "pending").get(),
  ]);

  let count = 0;
  for (const doc of pendingSnap.docs) {
    const data = doc.data();
    if (data && directReports.has(data.employeeId as string)) count += 1;
  }
  return count;
}

export async function computeManagerDashboard(
  managerId: string,
): Promise<ManagerDashboard> {
  const pendingDirectReportLeaveCount =
    await countPendingDirectReports(managerId);
  return { pendingDirectReportLeaveCount };
}

// ---- Employee --------------------------------------------------------------

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

function serialiseLeaveRequest(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): LeaveRequest {
  const data = doc.data() ?? {};
  return {
    leaveRequestId: doc.id,
    employeeId: (data.employeeId as string) ?? "",
    leaveTypeId: (data.leaveTypeId as string) ?? "",
    startDate: (data.startDate as string) ?? "",
    endDate: (data.endDate as string) ?? "",
    isHalfDay: (data.isHalfDay as boolean) ?? false,
    halfDayPeriod: data.halfDayPeriod as LeaveRequest["halfDayPeriod"],
    numberOfDays: (data.numberOfDays as number) ?? 0,
    reason: (data.reason as string) ?? "",
    status: (data.status as LeaveRequest["status"]) ?? "pending",
    submittedAt: toIso(data.submittedAt),
    managerId: data.managerId as string | undefined,
    managerActionAt: toIso(data.managerActionAt),
    managerRejectionReason: data.managerRejectionReason as string | undefined,
    reviewedBy: data.reviewedBy as string | undefined,
    reviewedAt: toIso(data.reviewedAt),
    rejectionReason: data.rejectionReason as string | undefined,
  };
}

async function fetchPendingLeaveRequests(
  employeeId: string,
): Promise<LeaveRequest[]> {
  const snap = await db
    .collection("leaveRequests")
    .where("employeeId", "==", employeeId)
    .get();
  return snap.docs
    .map((d) => serialiseLeaveRequest(d))
    .filter((lr) => lr.status === "pending")
    .sort((a, b) =>
      String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")),
    );
}

async function fetchLatestPublishedPayslip(employeeId: string): Promise<{
  month: number;
  year: number;
  status: PayslipStatus;
} | null> {
  const snap = await db
    .collection("payrollProfiles")
    .doc(employeeId)
    .collection("payslips")
    .get();

  let latest: Payslip | null = null;
  for (const doc of snap.docs) {
    const payslip = toPayslip(doc);
    if (!payslip || payslip.status !== "published") continue;
    if (
      !latest ||
      payslip.year > latest.year ||
      (payslip.year === latest.year && payslip.month > latest.month)
    ) {
      latest = payslip;
    }
  }
  return latest
    ? { month: latest.month, year: latest.year, status: latest.status }
    : null;
}

export async function computeEmployeeDashboard(
  employeeId: string,
): Promise<EmployeeDashboard> {
  const year = new Date().getFullYear();
  const [leaveBalances, pendingLeaveRequests, latestPayslip] =
    await Promise.all([
      computeLeaveBalances(employeeId, year),
      fetchPendingLeaveRequests(employeeId),
      fetchLatestPublishedPayslip(employeeId),
    ]);
  return { leaveBalances, pendingLeaveRequests, latestPayslip };
}

// ---- dispatcher ------------------------------------------------------------

/**
 * Returns the role-specific dashboard payload for the authenticated actor.
 * Manager and Employee dashboards read the actor's own record first so a
 * missing Employee record surfaces as a 404 (matching the leave-request route);
 * the Admin dashboard aggregates globally and needs no employee record.
 */
export async function getDashboard(
  actor: AuthContext,
): Promise<DashboardPayload> {
  switch (actor.role) {
    case "admin":
      return computeAdminDashboard();
    case "manager": {
      await fetchEmployee(actor.uid);
      return computeManagerDashboard(actor.uid);
    }
    case "employee": {
      await fetchEmployee(actor.uid);
      return computeEmployeeDashboard(actor.uid);
    }
  }
}
