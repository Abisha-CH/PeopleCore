import { Badge } from "@/components/ui/badge";
import type { LeaveRequestStatus, PayslipStatus } from "@/lib/types";

export type EmployeeStatus = "active" | "inactive";
export type { PayslipStatus };

const LEAVE_LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Pending",
  manager_approved: "Manager approved",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const LEAVE_VARIANTS: Record<LeaveRequestStatus, "warning" | "info" | "success" | "destructive" | "neutral"> = {
  pending: "warning",
  manager_approved: "info",
  approved: "success",
  rejected: "destructive",
  cancelled: "neutral",
};

/** Leave request workflow status. */
export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return <Badge variant={LEAVE_VARIANTS[status]}>{LEAVE_LABELS[status]}</Badge>;
}

/** Employee active/inactive status. */
export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return status === "active" ? (
    <Badge variant="success">
      <span className="h-1.5 w-1.5 rounded-full bg-success-600" aria-hidden="true" />
      Active
    </Badge>
  ) : (
    <Badge variant="neutral">
      <span className="h-1.5 w-1.5 rounded-full bg-slate-400" aria-hidden="true" />
      Inactive
    </Badge>
  );
}

/** Payslip draft/published lifecycle status. */
export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  return status === "published" ? (
    <Badge variant="success">Published</Badge>
  ) : (
    <Badge variant="warning">Draft</Badge>
  );
}
