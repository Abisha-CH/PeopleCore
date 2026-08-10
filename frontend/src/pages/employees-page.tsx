import { useMemo, useState } from "react";
import {
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Search,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { EmployeeFormDialog } from "@/components/employees/employee-form-dialog";
import { EmployeeDetailDialog } from "@/components/employees/employee-detail-dialog";
import {
  EmployeeStatusBadge,
} from "@/components/status-badge";
import { useDeleteEmployee, useEmployees } from "@/hooks/use-employees";
import { formatDate, getInitials } from "@/lib/format";
import type { EmployeeRecord } from "@/lib/types";
import { EmptyState } from "@/components/empty-state";

/*
 * EmployeesPage — HR Admin directory with CRUD and provisioning.
 *
 * Client-side filtering by search + status + department since the backend
 * supports status/department query params but not name search; deriving the
 * department list from the full dataset means no extra API calls.
 */

const PAGE_SIZE = 10;

const EMPLOYMENT_ROLE_BADGE: Record<string, "info" | "neutral" | "warning"> = {
  "full-time": "info",
  "part-time": "neutral",
  contract: "warning",
};

const EMPLOYMENT_ROLE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
};

export function EmployeesPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [department, setDepartment] = useState("all");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRecord | null>(null);
  const [detailTarget, setDetailTarget] = useState<EmployeeRecord | null>(null);
  const [deactivateTarget, setDeactivateTarget] =
    useState<EmployeeRecord | null>(null);

  const deleteEmployee = useDeleteEmployee();

  const employees = useEmployees(
    status !== "all" || department !== "all"
      ? {
          status: status !== "all" ? status : undefined,
          department: department !== "all" ? department : undefined,
        }
      : undefined,
  );

  const data = employees.data?.employees ?? [];

  // Departments: unique sorted values across the full dataset (for the filter)
  const departments = useMemo(() => {
    const allDepts = new Set(
      data.map((e) => e.department).filter(Boolean),
    );
    return Array.from(allDepts).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let list = data;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.fullName.toLowerCase().includes(q) ||
          e.email.toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, search]);

  const pageData = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Reset to page 1 when filters change
  function resetPage() {
    setPage(1);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage staff records and provision new accounts."
        actions={
          <Button
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Add employee
          </Button>
        }
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            placeholder="Search by name or email…"
            className="pl-9"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            aria-label="Search employees"
          />
        </div>
        <Select
          value={status}
          onValueChange={(v) => {
            setStatus(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={department}
          onValueChange={(v) => {
            setDepartment(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="Department" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All departments</SelectItem>
            {departments.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryState
        data={employees.data}
        isLoading={employees.isLoading}
        isError={employees.isError}
        error={employees.error}
        refetch={() => void employees.refetch()}
        isEmpty={(d) => d.employees.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={UserRound}
              title="No employees yet"
              description="Add your first employee to get started."
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
                      Department
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Job title
                    </TableHead>
                    <TableHead className="hidden md:table-cell">
                      Type
                    </TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Start date
                    </TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.length === 0 ? (
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
                    pageData.map((emp) => (
                      <TableRow key={emp.employeeId}>
                        <TableCell className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback className="text-xs">
                              {getInitials(emp.fullName)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">
                              {emp.fullName}
                            </p>
                            <p className="truncate text-xs text-muted-foreground">
                              {emp.email}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          {emp.department}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {emp.jobTitle}
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <Badge variant={EMPLOYMENT_ROLE_BADGE[emp.employmentRole] ?? "neutral"}>
                            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                            {EMPLOYMENT_ROLE_LABELS[emp.employmentRole] ?? emp.employmentRole}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <EmployeeStatusBadge status={emp.status} />
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-muted-foreground">
                          {formatDate(emp.startDate)}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            employee={emp}
                            onView={setDetailTarget}
                            onEdit={(e) => {
                              setEditTarget(e);
                              setFormOpen(true);
                            }}
                            onDeactivate={setDeactivateTarget}
                          />
                        </TableCell>
                      </TableRow>
                    ))
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

      {/* Create / edit dialog */}
      <EmployeeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(null);
        }}
        mode={editTarget ? "edit" : "create"}
        employee={editTarget}
      />

      {/* Detail dialog */}
      <EmployeeDetailDialog
        employee={detailTarget}
        onOpenChange={() => setDetailTarget(null)}
      />

      {/* Deactivate / reactivate confirmation */}
      <ConfirmDialog
        open={Boolean(deactivateTarget)}
        onOpenChange={(open) => {
          if (!open) setDeactivateTarget(null);
        }}
      >
        <ConfirmDialogContent
          title={
            deactivateTarget?.status === "inactive"
              ? "Reactivate employee"
              : "Deactivate employee"
          }
          description={`${
            deactivateTarget?.status === "inactive"
              ? `Reactivate ${deactivateTarget?.fullName}'s account? They will regain access.`
              : `Deactivate ${deactivateTarget?.fullName}'s account? They will lose access immediately. This can be reversed by reactivating them.`
          }`}
          confirmLabel={
            deactivateTarget?.status === "inactive" ? "Reactivate" : "Deactivate"
          }
          destructive={deactivateTarget?.status !== "inactive"}
          onConfirm={() => {
            if (deactivateTarget) {
              deleteEmployee.mutate(deactivateTarget.employeeId, {
                onSettled: () => setDeactivateTarget(null),
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
  employee,
  onView,
  onEdit,
  onDeactivate,
}: {
  employee: EmployeeRecord;
  onView: (employee: EmployeeRecord) => void;
  onEdit: (employee: EmployeeRecord) => void;
  onDeactivate: (employee: EmployeeRecord) => void;
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
        <DropdownMenuItem onClick={() => onView(employee)}>
          View details
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onEdit(employee)}>
          <Pencil className="h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => onDeactivate(employee)}
        >
          {employee.status === "inactive" ? "Reactivate" : "Deactivate"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
