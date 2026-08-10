import { useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Input } from "@/components/ui/input";
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
import { LeaveOverrideDialog } from "@/components/leave/leave-override-dialog";
import { EmptyState } from "@/components/empty-state";
import {
  useDeleteLeaveRequest,
  useLeaveRequests,
  useLeaveTypes,
} from "@/hooks/use-leave";
import { useEmployees } from "@/hooks/use-employees";
import { formatDateRange, formatDateTime, getInitials } from "@/lib/format";
import type { LeaveRequest, EmployeeRecord, LeaveType } from "@/lib/types";

/*
 * LeaveManagementPage — HR Admin view of all leave requests.
 *
 * Lists every request in the company with client-side employee-name search
 * plus server-side status / leave-type filters. Each row carries a full
 * action menu: view details, approve, reject, edit override (LEAVE-15), or
 * delete (LEAVE-15).
 *
 * Approve / reject are only available when the request has reached the
 * correct stage: final-stage for requests with a line manager, or direct
 * approval when no line manager is assigned.
 */

const PAGE_SIZE = 15;

const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "pending", label: "Pending" },
  { value: "manager_approved", label: "Manager approved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
] as const;

export function LeaveManagementPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [page, setPage] = useState(1);

  // Dialog state
  const [detailTarget, setDetailTarget] = useState<LeaveRequest | null>(null);
  const [overrideTarget, setOverrideTarget] = useState<LeaveRequest | null>(null);
  const [decisionTarget, setDecisionTarget] = useState<LeaveRequest | null>(null);
  const [decisionMode, setDecisionMode] = useState<"approve" | "reject">("approve");
  const [deleteTarget, setDeleteTarget] = useState<LeaveRequest | null>(null);

  const leaveRequests = useLeaveRequests({
    status: statusFilter !== "all" ? statusFilter : undefined,
    leaveTypeId: leaveTypeFilter !== "all" ? leaveTypeFilter : undefined,
  });
  const employeesQuery = useEmployees();
  const leaveTypesQuery = useLeaveTypes();
  const deleteRequest = useDeleteLeaveRequest();

  const data = leaveRequests.data?.leaveRequests ?? [];
  const employees = employeesQuery.data?.employees ?? [];
  const leaveTypes = leaveTypesQuery.data?.leaveTypes ?? [];

  const employeeMap = useMemo(() => {
    return new Map<string, EmployeeRecord>(employees.map((e) => [e.employeeId, e]));
  }, [employees]);

  const leaveTypeMap = useMemo(() => {
    return new Map<string, LeaveType>(leaveTypes.map((t) => [t.leaveTypeId, t]));
  }, [leaveTypes]);

  const filtered = useMemo(() => {
    if (!search) return data;
    const q = search.toLowerCase();
    return data.filter((r) => {
      const employee = employeeMap.get(r.employeeId);
      return employee?.fullName.toLowerCase().includes(q);
    });
  }, [data, search, employeeMap]);

  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() {
    setPage(1);
  }

  function isActionable(request: LeaveRequest) {
    if (request.status === "manager_approved") return true;
    if (request.status === "pending") {
      const employee = employeeMap.get(request.employeeId);
      return !employee?.lineManagerId;
    }
    return false;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        description="Review, approve or reject leave requests across the company."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search by employee name…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            aria-label="Search leave requests"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_FILTER_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={leaveTypeFilter}
          onValueChange={(v) => {
            setLeaveTypeFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Leave type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All leave types</SelectItem>
            {leaveTypes.map((type) => (
              <SelectItem key={type.leaveTypeId} value={type.leaveTypeId}>
                {type.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <QueryState
        data={leaveRequests.data}
        isLoading={leaveRequests.isLoading}
        isError={leaveRequests.isError}
        error={leaveRequests.error}
        refetch={() => void leaveRequests.refetch()}
        isEmpty={(d) => d.leaveRequests.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={CalendarDays}
              title="No leave requests"
              description="Leave requests will appear here once employees start requesting time off."
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
                    <TableHead className="hidden md:table-cell">
                      Leave type
                    </TableHead>
                    <TableHead>Dates</TableHead>
                    <TableHead className="hidden md:table-cell">Days</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Submitted
                    </TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7}>
                        <EmptyState
                          icon={Search}
                          title="No matches"
                          description="Try adjusting your search or filters."
                          tone="muted"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((request) => {
                      const employee = employeeMap.get(request.employeeId);
                      const leaveType = leaveTypeMap.get(request.leaveTypeId);
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
                              canAction={isActionable(request)}
                              onView={setDetailTarget}
                              onApprove={(r) => {
                                setDecisionMode("approve");
                                setDecisionTarget(r);
                              }}
                              onReject={(r) => {
                                setDecisionMode("reject");
                                setDecisionTarget(r);
                              }}
                              onOverride={setOverrideTarget}
                              onDelete={setDeleteTarget}
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
              total={filtered.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      {/* Detail dialog */}
      <LeaveDetailDialog
        request={detailTarget}
        employeeName={detailTarget ? employeeMap.get(detailTarget.employeeId)?.fullName : undefined}
        leaveTypeName={detailTarget ? leaveTypeMap.get(detailTarget.leaveTypeId)?.name : undefined}
        onOpenChange={(open) => { if (!open) setDetailTarget(null); }}
      />

      {/* Approve / reject dialog */}
      <LeaveDecisionDialog
        request={decisionTarget}
        mode={decisionMode}
        onDone={() => setDecisionTarget(null)}
      />

      {/* Override dialog */}
      <LeaveOverrideDialog
        request={overrideTarget}
        employees={employees}
        leaveTypes={leaveTypes}
        onDone={() => setOverrideTarget(null)}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <ConfirmDialogContent
          title="Delete leave request"
          description="This action is permanent and logged to the audit trail. The employee will not be notified automatically."
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteTarget) {
              deleteRequest.mutate(deleteTarget.leaveRequestId, {
                onSettled: () => setDeleteTarget(null),
              });
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
  canAction,
  onView,
  onApprove,
  onReject,
  onOverride,
  onDelete,
}: {
  request: LeaveRequest;
  canAction: boolean;
  onView: (request: LeaveRequest) => void;
  onApprove: (request: LeaveRequest) => void;
  onReject: (request: LeaveRequest) => void;
  onOverride: (request: LeaveRequest) => void;
  onDelete: (request: LeaveRequest) => void;
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
        <DropdownMenuItem onClick={() => onOverride(request)}>
          <Pencil className="h-4 w-4" />
          Override
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDelete(request)}
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
