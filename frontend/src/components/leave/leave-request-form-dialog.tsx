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
import { useCreateLeaveRequest } from "@/hooks/use-leave";
import type { LeaveType } from "@/lib/types";

/*
 * LeaveRequestFormDialog — employee self-service request form.
 *
 * The submitting user is taken from the session (never selectable), so the
 * form only asks for leave type, dates, half-day details and a reason.
 * Entitlement and overlap checks happen server-side; the dialog surfaces any
 * 400/409 as a toast.
 */

const schema = z
  .object({
    leaveTypeId: z.string().min(1, "Leave type is required."),
    startDate: z.string().min(1, "Start date is required."),
    endDate: z.string().min(1, "End date is required."),
    isHalfDay: z.boolean(),
    halfDayPeriod: z.enum(["morning", "afternoon"]).optional(),
    reason: z
      .string()
      .min(1, "Reason is required.")
      .max(500, "Reason must be 500 characters or fewer."),
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

const DEFAULT_VALUES: FormValues = {
  leaveTypeId: "",
  startDate: "",
  endDate: "",
  isHalfDay: false,
  halfDayPeriod: undefined,
  reason: "",
};

interface LeaveRequestFormDialogProps {
  open: boolean;
  leaveTypes: LeaveType[];
  onOpenChange: (open: boolean) => void;
}

export function LeaveRequestFormDialog({
  open,
  leaveTypes,
  onOpenChange,
}: LeaveRequestFormDialogProps) {
  const createRequest = useCreateLeaveRequest();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <LeaveRequestFormBody
          leaveTypes={leaveTypes}
          isSubmitting={createRequest.isPending}
          onDone={() => onOpenChange(false)}
          onSubmit={(values) =>
            createRequest.mutate(values, {
              onSuccess: () => onOpenChange(false),
            })
          }
        />
      )}
    </Dialog>
  );
}

function LeaveRequestFormBody({
  leaveTypes,
  isSubmitting,
  onDone,
  onSubmit,
}: {
  leaveTypes: LeaveType[];
  isSubmitting: boolean;
  onDone: () => void;
  onSubmit: (values: FormValues) => void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: DEFAULT_VALUES,
    mode: "onBlur",
  });

  const isHalfDay = form.watch("isHalfDay");
  const today = new Date().toISOString().slice(0, 10);

  return (
    <DialogContent className="max-w-xl">
      <DialogHeader>
        <DialogTitle>New leave request</DialogTitle>
        <DialogDescription>
          Your request goes to your line manager for approval. Entitlement and
          overlap checks run automatically.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="leaveTypeId"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Leave type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a leave type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {leaveTypes.map((type) => (
                        <SelectItem key={type.leaveTypeId} value={type.leaveTypeId}>
                          {type.name}
                          {type.isCapped ? " (capped)" : ""}
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
                    <Input type="date" min={today} {...field} />
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
                    <Input type="date" min={today} {...field} />
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
                          <SelectValue placeholder="Select period" />
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
          </div>

          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Reason</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Why the time off is needed"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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
              Submit request
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
