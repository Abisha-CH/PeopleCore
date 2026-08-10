import { useMemo, useState } from "react";
import {
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  Eye,
  MoreHorizontal,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  ConfirmDialogContent,
} from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { LeaveStatusBadge } from "@/components/status-badge";
import { LeaveDetailDialog } from "@/components/leave/leave-detail-dialog";
import { LeaveRequestFormDialog } from "@/components/leave/leave-request-form-dialog";
import { EmptyState } from "@/components/empty-state";
import { useLeaveRequests, useLeaveTypes, useUpdateLeaveRequestStatus } from "@/hooks/use-leave";
import { useEmployees } from "@/hooks/use-employees";
import { formatDateRange, formatDateTime } from "@/lib/format";
import type { LeaveRequest, EmployeeRecord, LeaveType } from "@/lib/types";

/*
 * MyLeavePage — employee self-service view of their own leave requests.
 *
 * The backend scopes the list to the authenticated user. Employees can submit
 * new requests, view the review trail, and cancel requests still pending.
 */

const PAGE_SIZE = 10;

export function MyLeavePage() {
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<LeaveRequest | null>(null);
  const [cancelTarget, setCancelTarget] = useState<LeaveRequest | null>(null);

  const requestsQuery = useLeaveRequests();
  const leaveTypesQuery = useLeaveTypes();
  const employeesQuery = useEmployees();
  const cancelRequest = useUpdateLeaveRequestStatus();

  const requests = useMemo(
    () => requestsQuery.data?.leaveRequests ?? [],
    [requestsQuery.data],
  );
  const leaveTypes = useMemo(
    () => leaveTypesQuery.data?.leaveTypes ?? [],
    [leaveTypesQuery.data],
  );
  const employees = useMemo(
    () => employeesQuery.data?.employees ?? [],
    [employeesQuery.data],
  );

  // Resolve this employee's own name for the detail dialog header.
  const employeeMap = useMemo(() => {
    return new Map<string, EmployeeRecord>(employees.map((e) => [e.employeeId, e]));
  }, [employees]);

  const leaveTypeMap = useMemo(() => {
    return new Map<string, LeaveType>(leaveTypes.map((t) => [t.leaveTypeId, t]));
  }, [leaveTypes]);

  const pendingCount = useMemo(
    () => requests.filter((r) => r.status === "pending").length,
    [requests],
  );
  const approvedDays = useMemo(
    () =>
      requests
        .filter((r) => r.status === "approved" || r.status === "manager_approved")
        .reduce((sum, r) => sum + r.numberOfDays, 0),
    [requests],
  );
  const rejectedCount = useMemo(
    () => requests.filter((r) => r.status === "rejected").length,
    [requests],
  );

  const pageData = requests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="My Leave"
          description="View, request and manage your time off."
        />
        <Button onClick={() => setCreateOpen(true)}>
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          New request
        </Button>
      </div>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          value={pendingCount}
          label="Awaiting decision"
          tone="warning"
        />
        <StatCard
          icon={CalendarRange}
          value={approvedDays}
          label="Approved days"
          tone="teal"
        />
        <StatCard
          icon={XCircle}
          value={rejectedCount}
          label="Rejected requests"
          tone="destructive"
        />
      </div>

      {/* Requests table */}
      <QueryState
        data={requestsQuery.data}
        isLoading={requestsQuery.isLoading}
        isError={requestsQuery.isError}
        error={requestsQuery.error}
        refetch={() => void requestsQuery.refetch()}
        isEmpty={(d) => d.leaveRequests.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests yet"
              description="Request your first time off with the button above."
            />
          </div>
        }
      >
        {() => (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-xs">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden md:table-cell">Leave type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead>Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState
                          icon={Search}
                          title="No requests"
                          description="Your submitted requests will be listed here."
                          tone="muted"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((request) => {
                      const leaveType = leaveTypeMap.get(request.leaveTypeId);
                      const canCancel = request.status === "pending";
                      return (
                        <TableRow key={request.leaveRequestId}>
                          <TableCell className="hidden md:table-cell">
                            {leaveType?.name ?? "—"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateRange(
                              request.startDate,
                              request.endDate,
                              request.isHalfDay,
                            )}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {request.numberOfDays}
                          </TableCell>
                          <TableCell>
                            <LeaveStatusBadge status={request.status} />
                          </TableCell>
                          <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                            {formatDateTime(request.submittedAt)}
                          </TableCell>
                          <TableCell>
                            <RowActions
                              request={request}
                              canCancel={canCancel}
                              onView={setDetailTarget}
                              onCancel={setCancelTarget}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={requests.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      {/* New request dialog */}
      <LeaveRequestFormDialog
        open={createOpen}
        leaveTypes={leaveTypes}
        onOpenChange={setCreateOpen}
      />

      {/* Detail dialog */}
      <LeaveDetailDialog
        request={detailTarget}
        employeeName={
          detailTarget ? employeeMap.get(detailTarget.employeeId)?.fullName : undefined
        }
        leaveTypeName={
          detailTarget ? leaveTypeMap.get(detailTarget.leaveTypeId)?.name : undefined
        }
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />

      {/* Cancel confirmation */}
      <ConfirmDialog
        open={Boolean(cancelTarget)}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <ConfirmDialogContent
          title="Cancel leave request"
          description={
            cancelTarget
              ? `Cancel your request for ${formatDateRange(
                  cancelTarget.startDate,
                  cancelTarget.endDate,
                  cancelTarget.isHalfDay,
                )}?`
              : ""
          }
          confirmLabel="Cancel request"
          destructive
          onConfirm={() => {
            if (cancelTarget) {
              cancelRequest.mutate(
                { leaveRequestId: cancelTarget.leaveRequestId, status: "cancelled" },
                { onSettled: () => setCancelTarget(null) },
              );
            }
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row actions dropdown                                                        */
/* -------------------------------------------------------------------------- */

function RowActions({
  request,
  canCancel,
  onView,
  onCancel,
}: {
  request: LeaveRequest;
  canCancel: boolean;
  onView: (request: LeaveRequest) => void;
  onCancel: (request: LeaveRequest) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">Actions</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onView(request)}>
          <Eye className="h-4 w-4" />
          View details
        </DropdownMenuItem>
        {canCancel && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onCancel(request)}
            >
              <X className="h-4 w-4" />
              Cancel request
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
