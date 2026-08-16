import { useMemo, useState } from "react";
import { Eye, History, Search } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { AuditEntryDialog } from "@/components/audit/audit-entry-dialog";
import { RoleBadge } from "@/components/layout/role-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
import { EmptyState } from "@/components/empty-state";
import { useAuditLog } from "@/hooks/use-audit";
import { useEmployees } from "@/hooks/use-employees";
import { formatAuditAction, formatDateTime, avatarToneClass, getInitials } from "@/lib/format";
import type { AuditLogEntry, EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * AuditLogPage — HR Admin view of the immutable audit trail.
 *
 * Every mutating action across the platform is recorded with its actor,
 * target and (for updates) a before/after field diff. This page surfaces
 * those entries with server-side filters — target type, actor, date range
 * and result count — plus a read-only diff viewer per entry.
 */

const PAGE_SIZE = 20;

const TARGET_TYPES = [
  "User",
  "Employee",
  "LeaveType",
  "LeaveEntitlement",
  "EmployeeLeaveEntitlement",
  "LeaveRequest",
  "PayrollProfile",
  "Payslip",
  "PublicHoliday",
] as const;

const LIMIT_OPTIONS = [25, 50, 100] as const;

export function AuditLogPage() {
  const [targetType, setTargetType] = useState("all");
  const [actorId, setActorId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState(50);
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<AuditLogEntry | null>(null);

  const auditQuery = useAuditLog({
    targetType: targetType !== "all" ? targetType : undefined,
    actorId: actorId !== "all" ? actorId : undefined,
    from: from || undefined,
    to: to ? `${to}T23:59:59.999Z` : undefined,
    limit,
  });
  const employeesQuery = useEmployees();

  const entries = useMemo(() => auditQuery.data?.entries ?? [], [auditQuery.data]);
  const employees = useMemo(
    () => employeesQuery.data?.employees ?? [],
    [employeesQuery.data],
  );

  const actorMap = useMemo(() => {
    return new Map<string, EmployeeRecord>(employees.map((e) => [e.employeeId, e]));
  }, [employees]);

  const pageData = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Log"
        description="A complete trail of admin and manager actions across the platform."
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={targetType}
          onValueChange={(v) => {
            setTargetType(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Target type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All target types</SelectItem>
            {TARGET_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={actorId}
          onValueChange={(v) => {
            setActorId(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="Actor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All actors</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.employeeId} value={employee.employeeId}>
                {employee.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2">
          <Input
            type="date"
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              resetPage();
            }}
            className="w-[150px]"
            aria-label="From date"
          />
          <span className="text-xs text-muted-foreground">to</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => {
              setTo(e.target.value);
              resetPage();
            }}
            className="w-[150px]"
            aria-label="To date"
          />
        </div>

        <Select
          value={String(limit)}
          onValueChange={(v) => {
            setLimit(Number(v));
            resetPage();
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="Limit" />
          </SelectTrigger>
          <SelectContent>
            {LIMIT_OPTIONS.map((option) => (
              <SelectItem key={option} value={String(option)}>
                {option} results
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <QueryState
        data={auditQuery.data}
        isLoading={auditQuery.isLoading}
        isError={auditQuery.isError}
        error={auditQuery.error}
        refetch={() => void auditQuery.refetch()}
        isEmpty={(d) => d.entries.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={History}
              title="No audit entries"
              description="Actions are recorded here as soon as someone creates, updates or deletes a record."
            />
          </div>
        }
      >
        {() => (
          <>
            <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="hidden lg:table-cell">Timestamp</TableHead>
                    <TableHead>Actor</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead className="hidden md:table-cell">Target</TableHead>
                    <TableHead>Changes</TableHead>
                    <TableHead className="w-[52px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState
                          icon={Search}
                          title="No matches"
                          description="Try adjusting your search or filters."
                          tone="muted"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((entry) => {
                      const employee = actorMap.get(entry.actorId);
                      return (
                        <TableRow key={entry.auditLogId}>
                          <TableCell className="hidden lg:table-cell whitespace-nowrap text-sm text-muted-foreground">
                            {formatDateTime(entry.timestamp)}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-8 w-8">
                                <AvatarFallback
                                  className={cn("text-xs", avatarToneClass(employee?.fullName))}
                                >
                                  {getInitials(employee?.fullName)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="truncate text-sm font-medium text-foreground">
                                  {employee?.fullName ?? "Unknown actor"}
                                </p>
                                <RoleBadge role={entry.actorRole} />
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-sm font-medium text-foreground">
                            {formatAuditAction(entry.action)}
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <p className="text-sm text-foreground">{entry.targetType}</p>
                            <p
                              className="max-w-[160px] truncate font-mono text-xs text-muted-foreground"
                              title={entry.targetId}
                            >
                              {entry.targetId}
                            </p>
                          </TableCell>
                          <TableCell>
                            {entry.diff && Object.keys(entry.diff).length > 0 ? (
                              <span className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2 py-0.5 text-sm font-semibold text-teal-700">
                                <span className="tabular-nums">
                                  {Object.keys(entry.diff).length}
                                </span>
                                change
                                {Object.keys(entry.diff).length === 1 ? "" : "s"}
                              </span>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setDetailTarget(entry)}
                              aria-label="View audit entry"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
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
              total={entries.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      {/* Detail dialog */}
      <AuditEntryDialog
        entry={detailTarget}
        actorName={
          detailTarget ? actorMap.get(detailTarget.actorId)?.fullName : undefined
        }
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />
    </div>
  );
}
