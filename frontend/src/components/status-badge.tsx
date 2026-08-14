import { Badge, type BadgeProps } from "@/components/ui/badge";
import type { LeaveRequestStatus, PayslipStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type EmployeeStatus = "active" | "inactive";
export type { PayslipStatus };

/* Colored status dot — the semantic state is never color-only: every badge
   keeps its text label, and the dot adds a fast-scan cue. */
function StatusDot({ className }: { className?: string }) {
  return (
    <span
      className={cn("h-1.5 w-1.5 shrink-0 rounded-full", className)}
      aria-hidden="true"
    />
  );
}

const LEAVE_LABELS: Record<LeaveRequestStatus, string> = {
  pending: "Pending",
  manager_approved: "Manager approved",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

const LEAVE_VARIANTS: Record<
  LeaveRequestStatus,
  Extract<BadgeProps["variant"], "warning" | "info" | "success" | "destructive" | "neutral">
> = {
  pending: "warning",
  manager_approved: "info",
  approved: "success",
  rejected: "destructive",
  cancelled: "neutral",
};

const LEAVE_DOT_COLORS: Record<LeaveRequestStatus, string> = {
  pending: "bg-warning-600",
  manager_approved: "bg-sky-600",
  approved: "bg-success-600",
  rejected: "bg-destructive-600",
  cancelled: "bg-muted-foreground",
};

/** Leave request workflow status. */
export function LeaveStatusBadge({ status }: { status: LeaveRequestStatus }) {
  return (
    <Badge variant={LEAVE_VARIANTS[status]}>
      <StatusDot className={LEAVE_DOT_COLORS[status]} />
      {LEAVE_LABELS[status]}
    </Badge>
  );
}

/** Employee active/inactive status. */
export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return status === "active" ? (
    <Badge variant="success">
      <StatusDot className="bg-success-600" />
      Active
    </Badge>
  ) : (
    <Badge variant="neutral">
      <StatusDot className="bg-muted-foreground" />
      Inactive
    </Badge>
  );
}

/** Payslip draft/published lifecycle status. */
export function PayslipStatusBadge({ status }: { status: PayslipStatus }) {
  return status === "published" ? (
    <Badge variant="success">
      <StatusDot className="bg-success-600" />
      Published
    </Badge>
  ) : (
    <Badge variant="violet">
      <StatusDot className="bg-violet-600" />
      Draft
    </Badge>
  );
}
