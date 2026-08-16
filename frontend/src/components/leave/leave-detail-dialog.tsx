import {
  CalendarDays,
  CheckCircle2,
  Clock,
  MessageSquareText,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LeaveStatusBadge, LeaveTypeBadge } from "@/components/status-badge";
import { avatarToneClass, formatDateRange, formatDateTime, getInitials } from "@/lib/format";
import type { LeaveRequest, LeaveRequestStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * LeaveDetailDialog — read-only view of a leave request with its review trail.
 * Shared by the admin (Leave Management) and employee (My Leave) pages.
 */

interface LeaveDetailDialogProps {
  request: LeaveRequest | null;
  employeeName?: string;
  leaveTypeName?: string;
  onOpenChange: (open: boolean) => void;
}

function Fact({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground sm:col-span-2 sm:mt-0">
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

export function LeaveDetailDialog({
  request,
  employeeName,
  leaveTypeName,
  onOpenChange,
}: LeaveDetailDialogProps) {
  if (!request) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback className={avatarToneClass(employeeName)}>
                {getInitials(employeeName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-lg">
                {employeeName ?? "Employee"}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {formatDateRange(
                  request.startDate,
                  request.endDate,
                  request.isHalfDay,
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <LeaveTypeBadge name={leaveTypeName} />
          <LeaveStatusBadge status={request.status} />
          <Badge variant="neutral">
            {request.numberOfDays} day{request.numberOfDays === 1 ? "" : "s"}
          </Badge>
        </div>

        <dl className="divide-y divide-border border-y border-border">
          <Fact label="Reason">
            <span className="inline-flex items-start gap-1.5">
              <MessageSquareText
                className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              {request.reason}
            </span>
          </Fact>
          <Fact label="Submitted">
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {formatDateTime(request.submittedAt)}
            </span>
          </Fact>
          {request.isHalfDay && request.halfDayPeriod && (
            <Fact label="Half day">
              <span className="capitalize">{request.halfDayPeriod}</span>
            </Fact>
          )}
        </dl>

        <ReviewTrail request={request} />
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Review trail — each step that has occurred, oldest first                     */
/* -------------------------------------------------------------------------- */

function ReviewTrail({ request }: { request: LeaveRequest }) {
  interface Step {
    label: string;
    when?: string;
    note?: string;
  }

  const steps: Step[] = [{ label: "Submitted", when: formatDateTime(request.submittedAt) }];

  if (request.managerActionAt) {
    steps.push({
      label:
        request.status === "manager_approved"
          ? "Approved by line manager"
          : "Line manager decision",
      when: formatDateTime(request.managerActionAt),
      note: request.managerRejectionReason
        ? `Rejected: ${request.managerRejectionReason}`
        : undefined,
    });
  }

  if (request.reviewedAt) {
    steps.push({
      label:
        request.status === "approved"
          ? "Approved by HR"
          : "Final decision by HR",
      when: formatDateTime(request.reviewedAt),
      note: request.rejectionReason
        ? `Rejected: ${request.rejectionReason}`
        : undefined,
    });
  }

  const isResolved =
    request.status === "approved" ||
    request.status === "rejected" ||
    request.status === "cancelled";

  // The final step's dot follows the current status so the trail reads as a
  // journey: completed steps are emerald, the open one is amber/sky/rose.
  const statusDot: Record<LeaveRequestStatus, string> = {
    pending: "bg-warning-100 text-warning-600",
    manager_approved: "bg-sky-100 text-sky-600",
    approved: "bg-emerald-100 text-emerald-600",
    rejected: "bg-rose-100 text-rose-600",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        Review trail
      </h3>
      <ol className="space-y-3">
        {steps.map((step, index) => {
          const isFinal = index === steps.length - 1;
          const done = isFinal
            ? statusDot[request.status]
            : "bg-emerald-100 text-emerald-600";
          return (
            <li key={step.label} className="flex gap-3">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  done,
                )}
                aria-hidden="true"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-x-2 text-sm font-medium text-foreground">
                  {step.label}
                  <span className="text-xs font-normal text-muted-foreground">
                    {step.when}
                  </span>
                </p>
                {step.note && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{step.note}</p>
                )}
              </div>
            </li>
          );
        })}
        {!isResolved && steps.length <= 1 && (
          <li className="flex items-center gap-2 text-xs text-muted-foreground">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
            Waiting for the next reviewer.
          </li>
        )}
      </ol>
    </section>
  );
}
