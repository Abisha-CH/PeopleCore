import { useMemo, useState } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  FileText,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  ReceiptText,
  Trash2,
  Wallet,
} from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { PayslipDetailDialog } from "@/components/payroll/payslip-detail-dialog";
import { PayslipStatusBadge } from "@/components/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ConfirmDialog,
  ConfirmDialogContent,
} from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Pagination } from "@/components/ui/pagination";
import { EmptyState } from "@/components/empty-state";
import { useEmployees } from "@/hooks/use-employees";
import {
  useCreatePayrollProfile,
  useDeletePayslip,
  useGeneratePayslip,
  usePayrollProfile,
  usePayslips,
  usePublishPayslip,
  useUpdatePayrollProfile,
  useUpdatePayslipDeductions,
} from "@/hooks/use-payroll";
import {
  formatCurrency,
  avatarToneClass,
  getInitials,
  monthName,
  monthYearLabel,
} from "@/lib/format";
import type {
  EmployeeRecord,
  PayrollProfile,
  Payslip,
} from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * PayrollPage — HR Admin console for payroll profiles and payslips.
 *
 * Profiles — per-employee banking and salary details, set up or edited here.
 * Payslips — draft payslips generated from the profile snapshot, deductions
 *            applied, then published so employees can view them.
 */

const PAGE_SIZE = 10;

export function PayrollPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Payroll"
        description="Manage banking details and generate monthly payslips."
      />

      <Tabs defaultValue="payslips">
        <TabsList>
          <TabsTrigger value="payslips">Payslips</TabsTrigger>
          <TabsTrigger value="profiles">Profiles</TabsTrigger>
        </TabsList>

        <TabsContent value="payslips" className="mt-4">
          <PayslipsTab />
        </TabsContent>
        <TabsContent value="profiles" className="mt-4">
          <ProfilesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Payslips tab                                                                */
/* -------------------------------------------------------------------------- */

const PAYSLIP_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
] as const;

function PayslipsTab() {
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [generateOpen, setGenerateOpen] = useState(false);
  const [detailTarget, setDetailTarget] = useState<Payslip | null>(null);
  const [deductionsTarget, setDeductionsTarget] = useState<Payslip | null>(null);
  const [publishTarget, setPublishTarget] = useState<Payslip | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Payslip | null>(null);

  const payslips = usePayslips({
    employeeId: employeeFilter !== "all" ? employeeFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
  });
  const employeesQuery = useEmployees();
  const deletePayslip = useDeletePayslip();
  const publishPayslip = usePublishPayslip();

  const employees = useMemo(() => employeesQuery.data?.employees ?? [], [employeesQuery.data]);
  const employeeMap = useMemo(() => {
    return new Map<string, EmployeeRecord>(employees.map((e) => [e.employeeId, e]));
  }, [employees]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Generate draft payslips, apply deductions, then publish them.
        </p>
        <Button size="sm" onClick={() => setGenerateOpen(true)}>
          <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Generate payslip
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={employeeFilter}
          onValueChange={setEmployeeFilter}
        >
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder="All employees" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((employee) => (
              <SelectItem key={employee.employeeId} value={employee.employeeId}>
                {employee.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {PAYSLIP_STATUS_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <QueryState
        data={payslips.data}
        isLoading={payslips.isLoading}
        isError={payslips.isError}
        error={payslips.error}
        refetch={() => void payslips.refetch()}
        isEmpty={(d) => d.payslips.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={FileText}
              title="No payslips"
              description="Generate a payslip to start the payroll run."
            />
          </div>
        }
      >
        {(d) => (
          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Base salary
                  </TableHead>
                  <TableHead className="hidden lg:table-cell">
                    Net salary
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[48px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.payslips.map((payslip) => {
                  const employee = employeeMap.get(payslip.employeeId);
                  return (
                    <TableRow key={payslip.payslipId}>
                      <TableCell className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback
                            className={cn("text-xs", avatarToneClass(employee?.fullName))}
                          >
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
                      <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                        {monthYearLabel(payslip.month, payslip.year)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">
                        {formatCurrency(payslip.baseSalary)}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="inline-flex items-center gap-1.5 rounded-lg border border-success-200 bg-success-50 px-2 py-1 text-sm font-semibold text-success-700 tabular-nums">
                          {formatCurrency(payslip.netSalary)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <PayslipStatusBadge status={payslip.status} />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon-sm">
                              <MoreHorizontal className="h-4 w-4" />
                              <span className="sr-only">Actions</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => setDetailTarget(payslip)}
                            >
                              <ReceiptText className="h-4 w-4" />
                              View details
                            </DropdownMenuItem>
                            {payslip.status === "draft" && (
                              <>
                                <DropdownMenuItem
                                  onClick={() => setDeductionsTarget(payslip)}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit deductions
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => setPublishTarget(payslip)}
                                >
                                  <FileText className="h-4 w-4 text-teal-600" />
                                  Publish
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(payslip)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      {/* Generate payslip */}
      <GeneratePayslipDialog
        open={generateOpen}
        onOpenChange={setGenerateOpen}
        employees={employees}
      />

      {/* Detail */}
      <PayslipDetailDialog
        payslip={detailTarget}
        employeeName={
          detailTarget ? employeeMap.get(detailTarget.employeeId)?.fullName : undefined
        }
        onOpenChange={(open) => { if (!open) setDetailTarget(null); }}
      />

      {/* Edit deductions */}
      <DeductionsDialog
        payslip={deductionsTarget}
        onDone={() => setDeductionsTarget(null)}
      />

      {/* Publish confirmation */}
      <ConfirmDialog
        open={Boolean(publishTarget)}
        onOpenChange={(open) => { if (!open) setPublishTarget(null); }}
      >
        <ConfirmDialogContent
          title="Publish payslip"
          description="Once published, the employee can view this payslip. Draft payslips cannot be edited after publishing."
          confirmLabel="Publish"
          onConfirm={() => {
            if (publishTarget) {
              publishPayslip.mutate(publishTarget.payslipId, {
                onSettled: () => setPublishTarget(null),
              });
            }
          }}
        />
      </ConfirmDialog>

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <ConfirmDialogContent
          title="Delete payslip"
          description="This draft payslip will be permanently removed. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteTarget) {
              deletePayslip.mutate(deleteTarget.payslipId, {
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
/* Generate payslip dialog                                                     */
/* -------------------------------------------------------------------------- */

const generateSchema = z.object({
  employeeId: z.string().min(1, "Employee is required."),
  month: z.coerce.number().int().min(1, "Month is required.").max(12),
  year: z.coerce.number().int().min(2000, "Year is required.").max(2100),
});

type GenerateFormValues = z.infer<typeof generateSchema>;

function GeneratePayslipDialog({
  open,
  onOpenChange,
  employees,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employees: EmployeeRecord[];
}) {
  const generatePayslip = useGeneratePayslip();
  const currentYear = new Date().getFullYear();

  const form = useForm<GenerateFormValues>({
    resolver: zodResolver(generateSchema),
    defaultValues: {
      employeeId: "",
      month: new Date().getMonth() + 1,
      year: currentYear,
    },
    mode: "onBlur",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Generate payslip</DialogTitle>
          <DialogDescription>
            Creates a draft payslip for the selected employee, month and year.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((values) =>
              generatePayslip.mutate(values, {
                onSuccess: () => onOpenChange(false),
              }),
            )}
            noValidate
            className="space-y-6"
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="employeeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Employee</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an employee" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem
                            key={employee.employeeId}
                            value={employee.employeeId}
                          >
                            {employee.fullName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="month"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Month</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={String(field.value)}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => i + 1).map(
                            (m) => (
                              <SelectItem key={m} value={String(m)}>
                                {monthName(m)}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="year"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Year</FormLabel>
                      <FormControl>
                        <Input type="number" min={2000} max={2100} {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="secondary"
                onClick={() => onOpenChange(false)}
                disabled={generatePayslip.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={generatePayslip.isPending}>
                {generatePayslip.isPending && (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                )}
                Generate
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Edit deductions dialog                                                      */
/* -------------------------------------------------------------------------- */

function buildDeductionsSchema(baseSalary: number) {
  return z
    .object({
      deductions: z
        .array(
          z.object({
            label: z.string().min(1, "Label is required."),
            amount: z.coerce.number().min(0, "Must be 0 or more."),
          }),
        )
        .min(1, "At least one deduction is required."),
    })
    .superRefine((val, ctx) => {
      const total = val.deductions.reduce((sum, d) => sum + d.amount, 0);
      if (total > baseSalary) {
        ctx.addIssue({
          code: "custom",
          path: ["deductions"],
          message: `Total deductions cannot exceed the base salary (${formatCurrency(baseSalary)}).`,
        });
      }
    });
}

type DeductionsFormValues = z.infer<ReturnType<typeof buildDeductionsSchema>>;

function DeductionsDialog({
  payslip,
  onDone,
}: {
  payslip: Payslip | null;
  onDone: () => void;
}) {
  const updateDeductions = useUpdatePayslipDeductions();

  return (
    <Dialog
      open={Boolean(payslip)}
      onOpenChange={(open) => { if (!open) onDone(); }}
    >
      {payslip && (
        <DialogContent className="max-w-md">
          <DeductionsBody
            key={payslip.payslipId}
            payslip={payslip}
            onDone={onDone}
            isSubmitting={updateDeductions.isPending}
            onSubmit={(deductions) =>
              updateDeductions.mutate(
                { payslipId: payslip.payslipId, deductions },
                { onSuccess: onDone },
              )
            }
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function DeductionsBody({
  payslip,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  payslip: Payslip;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (deductions: { label: string; amount: number }[]) => void;
}) {
  const schema = useMemo(() => buildDeductionsSchema(payslip.baseSalary), [payslip.baseSalary]);

  const form = useForm<DeductionsFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      deductions:
        payslip.deductions.length > 0
          ? payslip.deductions.map((d) => ({ label: d.label, amount: d.amount }))
          : [{ label: "", amount: 0 }],
    },
    mode: "onBlur",
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "deductions",
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>Edit deductions</DialogTitle>
        <DialogDescription>
          Deductions reduce the base salary snapshot of {formatCurrency(payslip.baseSalary)}.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit((values) => onSubmit(values.deductions))} noValidate className="space-y-6">
          <div className="space-y-3">
            {fields.map((field, index) => (
              <div key={field.id} className="flex items-start gap-2">
                <FormField
                  control={form.control}
                  name={`deductions.${index}.label`}
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input placeholder="e.g. Income Tax" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name={`deductions.${index}.amount`}
                  render={({ field }) => (
                    <FormItem className="w-28">
                      <FormControl>
                        <Input type="number" min={0} step="0.01" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="mt-0.5"
                  onClick={() => remove(index)}
                  disabled={fields.length <= 1}
                  aria-label="Remove deduction"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => append({ label: "", amount: 0 })}
          >
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add deduction
          </Button>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onDone}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              Save deductions
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Profiles tab                                                                */
/* -------------------------------------------------------------------------- */

function ProfilesTab() {
  const employeesQuery = useEmployees();
  const [page, setPage] = useState(1);
  const [dialogTarget, setDialogTarget] = useState<{
    employee: EmployeeRecord;
    profile?: PayrollProfile;
  } | null>(null);

  const employees = employeesQuery.data?.employees ?? [];
  const pageData = employees.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Banking and salary details used as the snapshot when generating payslips.
      </p>

      <QueryState
        data={employeesQuery.data}
        isLoading={employeesQuery.isLoading}
        isError={employeesQuery.isError}
        error={employeesQuery.error}
        refetch={() => void employeesQuery.refetch()}
        isEmpty={(d) => d.employees.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={Wallet}
              title="No employees"
              description="Add employees before setting up payroll profiles."
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
                    <TableHead>Employee</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Bank
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Account number
                    </TableHead>
                    <TableHead>Base salary</TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((employee) => (
                    <ProfileRow
                      key={employee.employeeId}
                      employee={employee}
                      onEdit={setDialogTarget}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>

            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={employees.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      <ProfileFormDialog
        target={dialogTarget}
        onDone={() => setDialogTarget(null)}
      />
    </div>
  );
}

function ProfileRow({
  employee,
  onEdit,
}: {
  employee: EmployeeRecord;
  onEdit: (target: { employee: EmployeeRecord; profile?: PayrollProfile }) => void;
}) {
  const profile = usePayrollProfile(employee.employeeId);
  const data = profile.data?.profile;

  return (
    <TableRow>
      <TableCell className="flex items-center gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback
            className={cn("text-xs", avatarToneClass(employee.fullName))}
          >
            {getInitials(employee.fullName)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-foreground">
            {employee.fullName}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {employee.department}
          </p>
        </div>
      </TableCell>
      <TableCell className="hidden md:table-cell">
        {data ? (
          data.bankName
        ) : profile.isLoading ? (
          <span className="text-muted-foreground">Loading…</span>
        ) : (
          <Badge variant="neutral">Not set up</Badge>
        )}
      </TableCell>
      <TableCell className="hidden lg:table-cell font-mono text-sm">
        {data?.bankAccountNumber ?? "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {data ? (
          <span className="font-semibold text-foreground">
            {formatCurrency(data.baseSalary)}
          </span>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onEdit({ employee, profile: data })}
        >
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">
            {data ? "Edit profile" : "Set up profile"}
          </span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile form dialog                                                         */
/* -------------------------------------------------------------------------- */

const profileSchema = z.object({
  bankAccountNumber: z
    .string()
    .min(1, "Account number is required.")
    .max(34, "Account numbers are at most 34 characters."),
  bankName: z.string().min(1, "Bank name is required."),
  baseSalary: z.coerce
    .number()
    .min(0, "Must be 0 or more.")
    .positive("Base salary must be greater than 0."),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

function ProfileFormDialog({
  target,
  onDone,
}: {
  target: { employee: EmployeeRecord; profile?: PayrollProfile } | null;
  onDone: () => void;
}) {
  const createProfile = useCreatePayrollProfile();
  const updateProfile = useUpdatePayrollProfile();
  const isSubmitting = createProfile.isPending || updateProfile.isPending;

  return (
    <Dialog
      open={Boolean(target)}
      onOpenChange={(open) => { if (!open) onDone(); }}
    >
      {target && (
        <DialogContent className="max-w-md">
          <ProfileFormBody
            key={target.employee.employeeId}
            employee={target.employee}
            profile={target.profile}
            onDone={onDone}
            isSubmitting={isSubmitting}
            onSubmit={(values) => {
              if (target.profile) {
                updateProfile.mutate(
                  { employeeId: target.employee.employeeId, ...values },
                  { onSuccess: onDone },
                );
              } else {
                createProfile.mutate(
                  { employeeId: target.employee.employeeId, ...values },
                  { onSuccess: onDone },
                );
              }
            }}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function ProfileFormBody({
  employee,
  profile,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  employee: EmployeeRecord;
  profile?: PayrollProfile;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (values: ProfileFormValues) => void;
}) {
  const form = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      bankAccountNumber: profile?.bankAccountNumber ?? "",
      bankName: profile?.bankName ?? "",
      baseSalary: profile?.baseSalary ?? 0,
    },
    mode: "onBlur",
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {profile ? "Edit payroll profile" : "Set up payroll profile"}
        </DialogTitle>
        <DialogDescription>
          Banking and salary details for{" "}
          <span className="font-medium text-foreground">{employee.fullName}</span>.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="bankName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bank name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. First National Bank" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="bankAccountNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 1234567890" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="baseSalary"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Base salary</FormLabel>
                  <FormControl>
                    <Input type="number" min={0} step="0.01" {...field} />
                  </FormControl>
                  <FormDescription>
                    Used as the snapshot when generating payslips.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={onDone}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              )}
              {profile ? "Save changes" : "Create profile"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
