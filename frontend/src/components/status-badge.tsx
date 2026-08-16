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

/* -------------------------------------------------------------------------- */
/* Leave type chip                                                             */
/* -------------------------------------------------------------------------- */

const LEAVE_TYPE_TONES: { chip: string; dot: string }[] = [
  { chip: "border-teal-200 bg-teal-50 text-teal-700", dot: "bg-teal-500" },
  { chip: "border-sky-200 bg-sky-50 text-sky-700", dot: "bg-sky-500" },
  { chip: "border-violet-200 bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  { chip: "border-warning-200 bg-warning-50 text-warning-700", dot: "bg-warning-500" },
  { chip: "border-brand-200 bg-brand-50 text-brand-700", dot: "bg-brand-500" },
  { chip: "border-emerald-200 bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
];

function toneForName(name: string): { chip: string; dot: string } {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  return LEAVE_TYPE_TONES[Math.abs(hash) % LEAVE_TYPE_TONES.length];
}

/** Tinted chip for a leave type — stable colour per type name. */
export function LeaveTypeBadge({ name }: { name?: string | null }) {
  if (!name) return <span className="text-sm text-muted-foreground">—</span>;
  const tone = toneForName(name);
  return (
    <Badge variant="outline" className={cn("border", tone.chip)}>
      <StatusDot className={tone.dot} />
      {name}
    </Badge>
  );
}
