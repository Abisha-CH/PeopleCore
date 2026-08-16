import { useState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useUpdateLeaveRequestStatus } from "@/hooks/use-leave";
import { formatDateRange } from "@/lib/format";
import type { LeaveRequest } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * LeaveDecisionDialog — approve / reject a leave request.
 *
 * Approve is a lightweight confirmation; reject requires a reason, which is
 * surfaced to the employee. `stage` picks the transition rules:
 *
 *  - "admin"  (default): first-stage approval moves to `approved`; rejections
 *    record `rejectionReason`. Used by the admin Leave Management page.
 *  - "manager": first-stage approval moves to `manager_approved`; rejections
 *    record `managerRejectionReason`. Used by the Leave Approvals page.
 */

interface LeaveDecisionDialogProps {
  request: LeaveRequest | null;
  mode: "approve" | "reject";
  onDone: () => void;
  /** Which reviewer stage this dialog is actioning. Defaults to "admin". */
  stage?: "admin" | "manager";
}

export function LeaveDecisionDialog({
  request,
  mode,
  onDone,
  stage = "admin",
}: LeaveDecisionDialogProps) {
  const updateStatus = useUpdateLeaveRequestStatus();
  const [reason, setReason] = useState("");
  const [attempted, setAttempted] = useState(false);

  const isManager = stage === "manager";
  const isApprove = mode === "approve";
  const isSubmitting = updateStatus.isPending;
  const reasonInvalid = attempted && reason.trim().length === 0;

  function submit() {
    if (!request) return;
    if (!isApprove && reason.trim().length === 0) {
      setAttempted(true);
      return;
    }
    updateStatus.mutate(
      {
        leaveRequestId: request.leaveRequestId,
        status: isApprove
          ? isManager
            ? "manager_approved"
            : "approved"
          : "rejected",
        ...(isManager
          ? { managerRejectionReason: isApprove ? undefined : reason.trim() }
          : { rejectionReason: isApprove ? undefined : reason.trim() }),
      },
      { onSuccess: onDone },
    );
  }

  return (
    <Dialog
      open={Boolean(request)}
      onOpenChange={(open) => {
        if (!open) onDone();
      }}
    >
      {request && (
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isApprove ? "Approve leave request" : "Reject leave request"}
            </DialogTitle>
            <DialogDescription>
              {isApprove
                ? isManager
                  ? "Approve this request. It will move to HR for final approval and the employee notified."
                  : "Confirm this request. It will be marked approved and the employee notified."
                : "Explain why this request is being rejected. The reason is recorded for the employee."}
            </DialogDescription>
          </DialogHeader>

          <div
            className={cn(
              "relative overflow-hidden rounded-xl border p-4",
              isApprove
                ? "border-emerald-200 bg-gradient-to-br from-emerald-50 via-slate-50 to-teal-50"
                : "border-rose-200 bg-gradient-to-br from-rose-50 via-slate-50 to-orange-50",
            )}
          >
            <span
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-lg shadow-md",
                isApprove
                  ? "bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-600/30"
                  : "bg-gradient-to-br from-rose-500 to-rose-700 text-white shadow-rose-600/30",
              )}
            >
              {isApprove ? (
                <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
              ) : (
                <XCircle className="h-4.5 w-4.5" aria-hidden="true" />
              )}
            </span>
            <p className="mt-3 text-sm font-medium text-foreground">
              {formatDateRange(request.startDate, request.endDate, request.isHalfDay)}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {request.numberOfDays} day{request.numberOfDays === 1 ? "" : "s"}
            </p>
          </div>

          {!isApprove && (
            <div className="space-y-2">
              <Label htmlFor="rejection-reason">Rejection reason</Label>
              <Textarea
                id="rejection-reason"
                placeholder="Required — the employee will see this."
                rows={3}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (attempted) setAttempted(false);
                }}
                aria-invalid={reasonInvalid}
              />
              {reasonInvalid && (
                <p className="text-xs text-destructive">
                  A rejection reason is required.
                </p>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="secondary"
              onClick={onDone}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={isApprove ? "default" : "destructive"}
              onClick={submit}
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {isApprove ? "Approve leave" : "Reject leave"}
            </Button>
          </DialogFooter>
        </DialogContent>
      )}
    </Dialog>
  );
}
