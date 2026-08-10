import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Textarea } from "@/components/ui/textarea";
import { useOverrideLeaveRequest } from "@/hooks/use-leave";
import type { EmployeeRecord, LeaveRequest, LeaveType } from "@/lib/types";

/*
 * LeaveOverrideDialog — HR Admin correction tool (LEAVE-15).
 *
 * The backend PUT replaces any substantive field on any request regardless of
 * status, bypassing entitlement checks. Used for corrections and overrides,
 * which is why the status itself is editable here.
 */

const STATUS_OPTIONS: { value: LeaveRequest["status"]; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "manager_approved", label: "Manager approved" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "cancelled", label: "Cancelled" },
];

const schema = z
  .object({
    employeeId: z.string().min(1, "Employee is required."),
    leaveTypeId: z.string().min(1, "Leave type is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    isHalfDay: z.boolean(),
    halfDayPeriod: z.enum(["morning", "afternoon"]).optional(),
    numberOfDays: z.coerce.number().min(0, "Days must be 0 or more."),
    reason: z.string().min(1, "Reason is required."),
    status: z.enum(["pending", "manager_approved", "approved", "rejected", "cancelled"]),
  })
  .superRefine((value, ctx) => {
    if (value.isHalfDay && !value.halfDayPeriod) {
      ctx.addIssue({
        code: "custom",
        path: ["halfDayPeriod"],
        message: "Half-day period is required.",
      });
    }
    if (value.isHalfDay && value.startDate !== value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Half-day leave requires start and end on the same day.",
      });
    }
    if (!value.isHalfDay && value.startDate > value.endDate) {
      ctx.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Start date must be on or before end date.",
      });
    }
  });

type FormValues = z.infer<typeof schema>;

interface LeaveOverrideDialogProps {
  request: LeaveRequest | null;
  employees: EmployeeRecord[];
  leaveTypes: LeaveType[];
  onDone: () => void;
}

export function LeaveOverrideDialog({
  request,
  employees,
  leaveTypes,
  onDone,
}: LeaveOverrideDialogProps) {
  const overrideRequest = useOverrideLeaveRequest();

  return (
    <Dialog open={Boolean(request)} onOpenChange={(open) => { if (!open) onDone(); }}>
      {request && (
        <OverrideBody
          key={request.leaveRequestId}
          request={request}
          employees={employees}
          leaveTypes={leaveTypes}
          onDone={onDone}
          isSubmitting={overrideRequest.isPending}
          onSubmit={(patch) =>
            overrideRequest.mutate(
              { leaveRequestId: request.leaveRequestId, ...patch },
              { onSuccess: onDone },
            )
          }
        />
      )}
    </Dialog>
  );
}

function OverrideBody({
  request,
  employees,
  leaveTypes,
  onDone,
  isSubmitting,
  onSubmit,
}: {
  request: LeaveRequest;
  employees: EmployeeRecord[];
  leaveTypes: LeaveType[];
  onDone: () => void;
  isSubmitting: boolean;
  onSubmit: (patch: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      employeeId: request.employeeId,
      leaveTypeId: request.leaveTypeId,
      startDate: request.startDate,
      endDate: request.endDate,
      isHalfDay: request.isHalfDay,
      halfDayPeriod: request.halfDayPeriod,
      numberOfDays: request.numberOfDays,
      reason: request.reason,
      status: request.status,
    },
    mode: "onBlur",
  });

  const isHalfDay = form.watch("isHalfDay");

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>Override leave request</DialogTitle>
        <DialogDescription>
          Correct any field on this request regardless of its status. Changes
          are written to the audit log.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
            <section className="space-y-4">
              <SectionLabel>Details</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employee</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((employee) => (
                            <SelectItem key={employee.employeeId} value={employee.employeeId}>
                              {employee.fullName}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="leaveTypeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Leave type</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {leaveTypes.map((type) => (
                            <SelectItem key={type.leaveTypeId} value={type.leaveTypeId}>
                              {type.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="startDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="endDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End date</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isHalfDay"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between gap-4 rounded-lg border border-border p-3">
                      <div>
                        <FormLabel>Half day</FormLabel>
                        <FormDescription>Counts as 0.5 of a day.</FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          aria-label="Half day"
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {isHalfDay && (
                  <FormField
                    control={form.control}
                    name="halfDayPeriod"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Period</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="morning">Morning</SelectItem>
                            <SelectItem value="afternoon">Afternoon</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <FormField
                  control={form.control}
                  name="numberOfDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of days</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          step="0.5"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="space-y-4">
              <SectionLabel>Decision</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormDescription>
                        Setting a status directly bypasses the normal workflow.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="reason"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Reason</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Why the time off is needed"
                          rows={2}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>
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
              Save override
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}
