import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  MoreHorizontal,
  Search,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { LeaveDecisionDialog } from "@/components/leave/leave-decision-dialog";
import { EmptyState } from "@/components/empty-state";
import { useLeaveRequests, useLeaveTypes } from "@/hooks/use-leave";
import { useEmployees } from "@/hooks/use-employees";
import { formatDateRange, formatDateTime, getInitials } from "@/lib/format";
import type { LeaveRequest, EmployeeRecord, LeaveType } from "@/lib/types";

/*
 * LeaveApprovalsPage — Line Manager view of their team's leave requests.
 *
 * The backend scopes this list to the manager's direct reports. Requests
 * arrive as `pending` (awaiting the manager's first-stage decision) and move
 * to `manager_approved` or `rejected`. Summary cards surface the queue at a
 * glance; the status filter narrows the table.
 */

const PAGE_SIZE = 15;

const STATUS_OPTIONS = [
  { value: "all", label: "All requests" },
  { value: "pending", label: "Awaiting decision" },
  { value: "manager_approved", label: "Pre-approved" },
  { value: "rejected", label: "Rejected" },
] as const;

export function LeaveApprovalsPage() {
  const [statusFilter, setStatusFilter] = useState("pending");
  const [page, setPage] = useState(1);

  // Dialog state
  const [detailTarget, setDetailTarget] = useState<LeaveRequest | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<LeaveRequest | null>(null);
  const [decisionMode, setDecisionMode] = useState<"approve" | "reject">("approve");

  const leaveRequestsQuery = useLeaveRequests();
  const employeesQuery = useEmployees();
  const leaveTypesQuery = useLeaveTypes();

  const allRequests = useMemo(
    () => leaveRequestsQuery.data?.leaveRequests ?? [],
    [leaveRequestsQuery.data],
  );
  const employees = useMemo(
    () => employeesQuery.data?.employees ?? [],
    [employeesQuery.data],
  );
  const leaveTypes = useMemo(
    () => leaveTypesQuery.data?.leaveTypes ?? [],
    [leaveTypesQuery.data],
  );

  const employeeMap = useMemo(() => {
    return new Map<string, EmployeeRecord>(employees.map((e) => [e.employeeId, e]));
  }, [employees]);

  const leaveTypeMap = useMemo(() => {
    return new Map<string, LeaveType>(leaveTypes.map((t) => [t.leaveTypeId, t]));
  }, [leaveTypes]);

  const pending = useMemo(
    () => allRequests.filter((r) => r.status === "pending"),
    [allRequests],
  );
  const preApproved = useMemo(
    () => allRequests.filter((r) => r.status === "manager_approved"),
    [allRequests],
  );
  const rejected = useMemo(
    () => allRequests.filter((r) => r.status === "rejected"),
    [allRequests],
  );

  const visible = useMemo(() => {
    if (statusFilter === "pending") return pending;
    if (statusFilter === "manager_approved") return preApproved;
    if (statusFilter === "rejected") return rejected;
    return allRequests;
  }, [statusFilter, allRequests, pending, preApproved, rejected]);

  const pageData = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() {
    setPage(1);
  }

  function openDecision(request: LeaveRequest, mode: "approve" | "reject") {
    setDecisionMode(mode);
    setDecisionTarget(request);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Approvals"
        description="Review and decide on leave requests from your direct reports."
      />

      {/* Queue summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          value={pending.length}
          label="Awaiting your decision"
          tone="warning"
        />
        <StatCard
          icon={CheckCircle2}
          value={preApproved.length}
          label="Pre-approved, awaiting HR"
          tone="teal"
        />
        <StatCard
          icon={XCircle}
          value={rejected.length}
          label="Rejected"
          tone="destructive"
        />
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <QueryState
        data={leaveRequestsQuery.data}
        isLoading={leaveRequestsQuery.isLoading}
        isError={leaveRequestsQuery.isError}
        error={leaveRequestsQuery.error}
        refetch={() => void leaveRequestsQuery.refetch()}
        isEmpty={(d) => d.leaveRequests.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests yet"
              description="Leave requests from your direct reports will appear here."
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
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden md:table-cell">Leave type</TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="hidden md:table-cell">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Submitted</TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visible.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          icon={Search}
                          title="No matches"
                          description="There are no requests in this state right now."
                          tone="muted"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((request) => {
                      const employee = employeeMap.get(request.employeeId);
                      const leaveType = leaveTypeMap.get(request.leaveTypeId);
                      const canAction = request.status === "pending";
                      return (
                        <TableRow key={request.leaveRequestId}>
                          <TableCell className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="text-xs">
                                {getInitials(employee?.fullName)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-foreground">
                                {employee?.fullName ?? "Unknown employee"}
                              </p>
                              <p className="truncate text-xs text-muted-foreground">
                                {employee?.department}
                              </p>
                            </div>
                          </TableCell>
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
                          <TableCell className="hidden md:table-cell tabular-nums">
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
                              canAction={canAction}
                              onView={setDetailTarget}
                              onApprove={(r) => openDecision(r, "approve")}
                              onReject={(r) => openDecision(r, "reject")}
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
              total={visible.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

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

      {/* Approve / reject dialog (manager first-stage) */}
      <LeaveDecisionDialog
        request={decisionTarget}
        mode={decisionMode}
        stage="manager"
        onDone={() => setDecisionTarget(null)}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row actions dropdown                                                        */
/* -------------------------------------------------------------------------- */

function RowActions({
  request,
  canAction,
  onView,
  onApprove,
  onReject,
}: {
  request: LeaveRequest;
  canAction: boolean;
  onView: (request: LeaveRequest) => void;
  onApprove: (request: LeaveRequest) => void;
  onReject: (request: LeaveRequest) => void;
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
          View details
        </DropdownMenuItem>
        {canAction && (
          <>
            <DropdownMenuItem onClick={() => onApprove(request)}>
              <CheckCircle2 className="h-4 w-4 text-success-600" />
              Approve
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => onReject(request)}
            >
              <XCircle className="h-4 w-4" />
              Reject
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
