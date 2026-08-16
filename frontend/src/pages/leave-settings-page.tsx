import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  CalendarDays,
  Loader2,
  MoreHorizontal,
  Pencil,
  PlusCircle,
  Settings2,
  Trash2,
} from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
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
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/empty-state";
import {
  useCreateHoliday,
  useCreateLeaveType,
  useDeleteHoliday,
  useDeleteLeaveType,
  useLeaveEntitlement,
  useLeaveTypes,
  usePublicHolidays,
  useSetLeaveEntitlement,
  useUpdateHoliday,
  useUpdateLeaveType,
} from "@/hooks/use-leave";
import { formatDate } from "@/lib/format";
import type { LeaveType, PublicHoliday } from "@/lib/types";
import { LeaveTypeBadge } from "@/components/status-badge";

/*
 * LeaveSettingsPage — three-tab settings console for HR Admin.
 *
 * Leave Types     — CRUD for the leave types dictionary.
 * Entitlements    — company-wide daysPerYear per capped leave type.
 * Public Holidays — CRUD for the public holiday calendar.
 */

export function LeaveSettingsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Settings"
        description="Configure leave types, company-wide entitlements and public holidays."
      />

      <Tabs defaultValue="types">
        <TabsList>
          <TabsTrigger value="types">Leave types</TabsTrigger>
          <TabsTrigger value="entitlements">Entitlements</TabsTrigger>
          <TabsTrigger value="holidays">Public holidays</TabsTrigger>
        </TabsList>

        <TabsContent value="types" className="mt-4">
          <LeaveTypesTab />
        </TabsContent>
        <TabsContent value="entitlements" className="mt-4">
          <EntitlementsTab />
        </TabsContent>
        <TabsContent value="holidays" className="mt-4">
          <PublicHolidaysTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Leave Types tab                                                             */
/* -------------------------------------------------------------------------- */

const leaveTypeFormSchema = z
  .object({
    name: z.string().min(1, "Name is required."),
    isCapped: z.boolean(),
    defaultDaysPerYear: z.coerce.number().min(0, "Must be 0 or more."),
  })
  .superRefine((val, ctx) => {
    if (val.isCapped && val.defaultDaysPerYear === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["defaultDaysPerYear"],
        message: "Must be greater than 0 for capped leave types.",
      });
    }
  });

type LeaveTypeFormValues = z.infer<typeof leaveTypeFormSchema>;

function LeaveTypesTab() {
  const leaveTypes = useLeaveTypes();
  const createType = useCreateLeaveType();
  const updateType = useUpdateLeaveType();
  const deleteType = useDeleteLeaveType();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<LeaveType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LeaveType | null>(null);

  const isSubmitting = createType.isPending || updateType.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Define the types of leave your organisation supports.
        </p>
        <Button
          size="sm"
          onClick={() => {
            setEditTarget(null);
            setFormOpen(true);
          }}
        >
          <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
          Add type
        </Button>
      </div>

      <QueryState
        data={leaveTypes.data}
        isLoading={leaveTypes.isLoading}
        isError={leaveTypes.isError}
        error={leaveTypes.error}
        refetch={() => void leaveTypes.refetch()}
        isEmpty={(d) => d.leaveTypes.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={Settings2}
              title="No leave types"
              description="Create your first leave type to get started."
            />
          </div>
        }
      >
        {(d) => (
          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Capped</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Default days/year
                  </TableHead>
                  <TableHead className="w-[48px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {d.leaveTypes.map((type) => (
                  <TableRow key={type.leaveTypeId}>
                    <TableCell>
                      <LeaveTypeBadge name={type.name} />
                    </TableCell>
                    <TableCell>
                      {type.isCapped ? (
                        <Badge variant="info">Capped</Badge>
                      ) : (
                        <Badge variant="neutral">Uncapped</Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell tabular-nums">
                      {type.defaultDaysPerYear}
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
                            onClick={() => {
                              setEditTarget(type);
                              setFormOpen(true);
                            }}
                          >
                            <Pencil className="h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            variant="destructive"
                            onClick={() => setDeleteTarget(type)}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      {/* Create / edit dialog */}
      <LeaveTypeFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(null);
        }}
        mode={editTarget ? "edit" : "create"}
        leaveType={editTarget}
        isSubmitting={isSubmitting}
        onDone={() => setFormOpen(false)}
        onSubmit={(values) => {
          if (editTarget) {
            updateType.mutate(
              { leaveTypeId: editTarget.leaveTypeId, ...values },
              { onSuccess: () => setFormOpen(false) },
            );
          } else {
            createType.mutate(values, { onSuccess: () => setFormOpen(false) });
          }
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <ConfirmDialogContent
          title="Delete leave type"
          description="Removing a leave type may affect active entitlements and pending requests. This cannot be undone."
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteTarget) {
              deleteType.mutate(deleteTarget.leaveTypeId, {
                onSettled: () => setDeleteTarget(null),
              });
            }
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

function LeaveTypeFormDialog({
  open,
  onOpenChange,
  mode,
  leaveType,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  leaveType: LeaveType | null;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (values: LeaveTypeFormValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-w-md">
          <LeaveTypeFormBody
            key={`${mode}-${leaveType?.leaveTypeId ?? "new"}`}
            mode={mode}
            leaveType={leaveType}
            onDone={onDone}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function LeaveTypeFormBody({
  mode,
  leaveType,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  mode: "create" | "edit";
  leaveType: LeaveType | null;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (values: LeaveTypeFormValues) => void;
}) {
  const form = useForm<LeaveTypeFormValues>({
    resolver: zodResolver(leaveTypeFormSchema),
    defaultValues: {
      name: leaveType?.name ?? "",
      isCapped: leaveType?.isCapped ?? true,
      defaultDaysPerYear: leaveType?.defaultDaysPerYear ?? 20,
    },
    mode: "onBlur",
  });

  const isCapped = form.watch("isCapped");

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "edit" ? "Edit leave type" : "Add leave type"}
        </DialogTitle>
        <DialogDescription>
          {mode === "edit"
            ? "Update this leave type's configuration."
            : "Create a new leave type for your organisation."}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Annual Leave" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isCapped"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                  <div>
                    <FormLabel>Capped</FormLabel>
                    <FormDescription>
                      Capped types have a fixed annual entitlement.
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      aria-label="Capped"
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            {isCapped && (
              <FormField
                control={form.control}
                name="defaultDaysPerYear"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default days per year</FormLabel>
                    <FormControl>
                      <Input type="number" min={0} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
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
              {mode === "edit" ? "Save changes" : "Create type"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Entitlements tab                                                            */
/* -------------------------------------------------------------------------- */

function EntitlementsTab() {
  const leaveTypes = useLeaveTypes();
  const cappedTypes = (leaveTypes.data?.leaveTypes ?? []).filter(
    (t) => t.isCapped,
  );

  const [editTarget, setEditTarget] = useState<LeaveType | null>(null);

  if (leaveTypes.isLoading) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  if (leaveTypes.isError) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-50 p-4 text-sm text-destructive">
        Failed to load leave types.
      </div>
    );
  }

  if (cappedTypes.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card/50">
        <EmptyState
          icon={Settings2}
          title="No capped leave types"
          description="Create a capped leave type first to configure entitlements."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Set the company-wide annual entitlement for each capped leave type.
        Individual employee overrides take precedence.
      </p>

      <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Leave type</TableHead>
              <TableHead>Days per year</TableHead>
              <TableHead className="w-[48px]">
                <span className="sr-only">Actions</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cappedTypes.map((type) => (
              <EntitlementRow
                key={type.leaveTypeId}
                leaveType={type}
                onEdit={setEditTarget}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <EntitlementEditDialog
        leaveType={editTarget}
        onDone={() => setEditTarget(null)}
      />
    </div>
  );
}

function EntitlementRow({
  leaveType,
  onEdit,
}: {
  leaveType: LeaveType;
  onEdit: (type: LeaveType) => void;
}) {
  const entitlement = useLeaveEntitlement(leaveType.leaveTypeId);

  return (
    <TableRow>
      <TableCell className="font-medium">{leaveType.name}</TableCell>
      <TableCell className="tabular-nums">
        {entitlement.isLoading ? (
          <span className="text-muted-foreground">Loading…</span>
        ) : (
          entitlement.data?.entitlement?.daysPerYear ??
          leaveType.defaultDaysPerYear
        )}
      </TableCell>
      <TableCell>
        <Button variant="ghost" size="icon-sm" onClick={() => onEdit(leaveType)}>
          <Pencil className="h-4 w-4" aria-hidden="true" />
          <span className="sr-only">Edit</span>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function EntitlementEditDialog({
  leaveType,
  onDone,
}: {
  leaveType: LeaveType | null;
  onDone: () => void;
}) {
  const setEntitlement = useSetLeaveEntitlement();

  return (
    <Dialog
      open={Boolean(leaveType)}
      onOpenChange={(open) => { if (!open) onDone(); }}
    >
      {leaveType && (
        <DialogContent className="max-w-sm">
          <EntitlementBody
            key={leaveType.leaveTypeId}
            leaveType={leaveType}
            onDone={onDone}
            isSubmitting={setEntitlement.isPending}
            onSubmit={(daysPerYear) =>
              setEntitlement.mutate(
                { leaveTypeId: leaveType.leaveTypeId, daysPerYear },
                { onSuccess: onDone },
              )
            }
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function EntitlementBody({
  leaveType,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  leaveType: LeaveType;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (daysPerYear: number) => void;
}) {
  const entitlement = useLeaveEntitlement(leaveType.leaveTypeId);
  const currentDays =
    entitlement.data?.entitlement?.daysPerYear ?? leaveType.defaultDaysPerYear;

  const [days, setDays] = useState(String(currentDays));

  // Sync the field once the current entitlement finishes loading.
  useEffect(() => {
    if (!entitlement.isLoading) {
      setDays(String(currentDays));
    }
  }, [entitlement.isLoading, currentDays]);

  const value = Number(days);
  const valid = Number.isFinite(value) && value >= 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update entitlement</DialogTitle>
        <DialogDescription>
          Set the annual day entitlement for{" "}
          <span className="font-medium text-foreground">{leaveType.name}</span>.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-2">
        <label htmlFor="entitlement-days" className="text-sm font-medium">
          Days per year
        </label>
        <Input
          id="entitlement-days"
          type="number"
          min={0}
          step="0.5"
          value={days}
          onChange={(e) => setDays(e.target.value)}
          aria-invalid={!valid}
        />
      </div>

      <DialogFooter>
        <Button variant="secondary" onClick={onDone} disabled={isSubmitting}>
          Cancel
        </Button>
        <Button
          onClick={() => {
            if (valid) onSubmit(value);
          }}
          disabled={isSubmitting || !valid}
        >
          {isSubmitting && (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          )}
          Save
        </Button>
      </DialogFooter>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Public Holidays tab                                                         */
/* -------------------------------------------------------------------------- */

const holidayFormSchema = z.object({
  name: z.string().min(1, "Name is required."),
  date: z.string().min(1, "Date is required."),
});

type HolidayFormValues = z.infer<typeof holidayFormSchema>;

function PublicHolidaysTab() {
  const [year, setYear] = useState(new Date().getFullYear());
  const holidays = usePublicHolidays(year);
  const createHoliday = useCreateHoliday();
  const updateHoliday = useUpdateHoliday();
  const deleteHoliday = useDeleteHoliday();

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PublicHoliday | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PublicHoliday | null>(null);

  const yearOptions = [year - 1, year, year + 1];
  const isSubmitting = createHoliday.isPending || updateHoliday.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Public holidays are excluded from leave-day calculations.
        </p>
        <div className="flex items-center gap-3">
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            onClick={() => {
              setEditTarget(null);
              setFormOpen(true);
            }}
          >
            <PlusCircle className="mr-1.5 h-4 w-4" aria-hidden="true" />
            Add holiday
          </Button>
        </div>
      </div>

      <QueryState
        data={holidays.data}
        isLoading={holidays.isLoading}
        isError={holidays.isError}
        error={holidays.error}
        refetch={() => void holidays.refetch()}
        isEmpty={(d) => d.publicHolidays.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={CalendarDays}
              title="No public holidays"
              description="Add public holidays for the selected year."
            />
          </div>
        }
      >
        {(d) => (
          <div className="overflow-x-auto rounded-xl border border-border/80 bg-card shadow-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="hidden md:table-cell">Year</TableHead>
                  <TableHead className="w-[48px]">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...d.publicHolidays]
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((holiday) => (
                    <TableRow key={holiday.publicHolidayId}>
                      <TableCell className="font-medium">
                        {holiday.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(holiday.date)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell tabular-nums">
                        {holiday.year}
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
                              onClick={() => {
                                setEditTarget(holiday);
                                setFormOpen(true);
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                              Edit
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              onClick={() => setDeleteTarget(holiday)}
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}
      </QueryState>

      {/* Create / edit dialog */}
      <HolidayFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(null);
        }}
        mode={editTarget ? "edit" : "create"}
        holiday={editTarget}
        year={year}
        isSubmitting={isSubmitting}
        onDone={() => setFormOpen(false)}
        onSubmit={(values) => {
          if (editTarget) {
            updateHoliday.mutate(
              {
                publicHolidayId: editTarget.publicHolidayId,
                name: values.name,
                date: values.date,
              },
              { onSuccess: () => setFormOpen(false) },
            );
          } else {
            createHoliday.mutate(values, {
              onSuccess: () => setFormOpen(false),
            });
          }
        }}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
      >
        <ConfirmDialogContent
          title="Delete holiday"
          description="This holiday will no longer be excluded from leave-day calculations."
          confirmLabel="Delete"
          destructive
          onConfirm={() => {
            if (deleteTarget) {
              deleteHoliday.mutate(deleteTarget.publicHolidayId, {
                onSettled: () => setDeleteTarget(null),
              });
            }
          }}
        />
      </ConfirmDialog>
    </div>
  );
}

function HolidayFormDialog({
  open,
  onOpenChange,
  mode,
  holiday,
  year,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  holiday: PublicHoliday | null;
  year: number;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (values: HolidayFormValues) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <DialogContent className="max-w-md">
          <HolidayFormBody
            key={`${mode}-${holiday?.publicHolidayId ?? "new"}`}
            mode={mode}
            holiday={holiday}
            year={year}
            onDone={onDone}
            isSubmitting={isSubmitting}
            onSubmit={onSubmit}
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

function HolidayFormBody({
  mode,
  holiday,
  year,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  mode: "create" | "edit";
  holiday: PublicHoliday | null;
  year: number;
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (values: HolidayFormValues) => void;
}) {
  const form = useForm<HolidayFormValues>({
    resolver: zodResolver(holidayFormSchema),
    defaultValues: {
      name: holiday?.name ?? "",
      date: holiday?.date ?? `${year}-01-01`,
    },
    mode: "onBlur",
  });

  return (
    <>
      <DialogHeader>
        <DialogTitle>
          {mode === "edit" ? "Edit holiday" : "Add holiday"}
        </DialogTitle>
        <DialogDescription>
          {mode === "edit"
            ? "Update this public holiday."
            : "Add a new public holiday to the calendar."}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. Christmas Day" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
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
              {mode === "edit" ? "Save changes" : "Add holiday"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </>
  );
}
