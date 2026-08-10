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
import { Textarea } from "@/components/ui/textarea";
import {
  useCreateEmployee,
  useUpdateEmployee,
  type CreateEmployeePayload,
} from "@/hooks/use-employees";
import { useUsers } from "@/hooks/use-users";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * EmployeeFormDialog — create (with provisioning) or edit an employee.
 *
 * Create mode adds two fields the backend only accepts at provisioning time:
 * a temporary password and the Firebase claim role (employee / manager).
 * Edit mode sends only business fields.
 */

const baseFields = {
  fullName: z.string().min(1, "Full name is required."),
  email: z.string().email("Enter a valid email address."),
  phone: z.string().min(1, "Phone number is required."),
  department: z.string().min(1, "Department is required."),
  jobTitle: z.string().min(1, "Job title is required."),
  employmentRole: z.enum(["full-time", "part-time", "contract"]),
  startDate: z.string().min(1, "Start date is required."),
  status: z.enum(["active", "inactive"]),
  nationalId: z.string().min(1, "National ID is required."),
  address: z.string().min(1, "Address is required."),
  lineManagerId: z.string().optional(),
  emergencyContactName: z.string().optional(),
  emergencyContactPhone: z.string().optional(),
  emergencyContactRelationship: z.string().optional(),
} as const;

const createSchema = z.object({
  ...baseFields,
  password: z.string().min(6, "Password must be at least 6 characters."),
  role: z.enum(["employee", "manager"]).default("employee"),
});

const editSchema = z.object(baseFields);

type CreateFormValues = z.infer<typeof createSchema>;
type FormValues = CreateFormValues & Partial<Pick<CreateFormValues, "password" | "role">>;

const NO_MANAGER = "__none__";

interface EmployeeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  employee?: EmployeeRecord | null;
}

export function EmployeeFormDialog({
  open,
  onOpenChange,
  mode,
  employee,
}: EmployeeFormDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <FormBody
          key={mode === "edit" && employee ? employee.employeeId : "create"}
          mode={mode}
          employee={employee}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/* Form body                                                                   */
/* -------------------------------------------------------------------------- */

function FormBody({
  mode,
  employee,
  onDone,
}: {
  mode: "create" | "edit";
  employee?: EmployeeRecord | null;
  onDone: () => void;
}) {
  const createEmployee = useCreateEmployee();
  const updateEmployee = useUpdateEmployee();
  const managersQuery = useUsers("manager");
  const managers = managersQuery.data?.users ?? [];

  const isEdit = mode === "edit";
  const defaults: FormValues = {
    fullName: employee?.fullName ?? "",
    email: employee?.email ?? "",
    phone: employee?.phone ?? "",
    department: employee?.department ?? "",
    jobTitle: employee?.jobTitle ?? "",
    employmentRole: employee?.employmentRole ?? "full-time",
    startDate: employee?.startDate ?? "",
    status: employee?.status ?? "active",
    nationalId: employee?.nationalId ?? "",
    address: employee?.address ?? "",
    lineManagerId: employee?.lineManagerId ?? undefined,
    emergencyContactName: employee?.emergencyContact?.name ?? "",
    emergencyContactPhone: employee?.emergencyContact?.phone ?? "",
    emergencyContactRelationship: employee?.emergencyContact?.relationship ?? "",
    password: "",
    role: "employee",
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(isEdit ? editSchema : createSchema),
    defaultValues: defaults,
    mode: "onBlur",
  });

  const isSubmitting =
    createEmployee.isPending || updateEmployee.isPending;

  type EmployeePayload = Omit<CreateEmployeePayload, "password" | "role">;

  function toPayload(values: FormValues): EmployeePayload {
    const hasEmergencyContact =
      Boolean(values.emergencyContactName) ||
      Boolean(values.emergencyContactPhone) ||
      Boolean(values.emergencyContactRelationship);

    return {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      department: values.department,
      jobTitle: values.jobTitle,
      employmentRole: values.employmentRole,
      startDate: values.startDate,
      status: values.status,
      nationalId: values.nationalId,
      address: values.address,
      lineManagerId:
        values.lineManagerId && values.lineManagerId !== NO_MANAGER
          ? values.lineManagerId
          : undefined,
      emergencyContact: hasEmergencyContact
        ? {
            name: values.emergencyContactName!,
            phone: values.emergencyContactPhone!,
            relationship: values.emergencyContactRelationship!,
          }
        : undefined,
    };
  }

  function onSubmit(values: FormValues) {
    if (isEdit && employee) {
      updateEmployee.mutate(
        { ...toPayload(values), employeeId: employee.employeeId },
        { onSuccess: onDone },
      );
      return;
    }
    // Create mode: password + role are guaranteed by the create schema.
    createEmployee.mutate(
      { ...toPayload(values), password: values.password!, role: values.role },
      { onSuccess: onDone },
    );
  }

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit employee" : "Add employee"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? `Update ${employee?.fullName ?? "this employee"}'s record. Changes are audited.`
            : "Provision an account and create the employee record in one step."}
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6"
          noValidate
        >
          <div className="max-h-[60vh] space-y-6 overflow-y-auto pr-1">
            {/* Account & access */}
            {!isEdit && (
              <section className="space-y-4">
                <SectionLabel>Account &amp; access</SectionLabel>
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Work email</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="you@company.com"
                            type="email"
                            autoComplete="off"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temporary password</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Set a first-time password"
                            type="password"
                            autoComplete="new-password"
                            {...field}
                          />
                        </FormControl>
                        <FormDescription>
                          At least 6 characters.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Access role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="employee">Employee</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          Managers review their team&apos;s leave requests.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </section>
            )}

            {/* Employment */}
            <section className="space-y-4">
              <SectionLabel>Employment</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Full name</FormLabel>
                      <FormControl>
                        <Input placeholder="Jane Smith" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="department"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department</FormLabel>
                      <FormControl>
                        <Input placeholder="Engineering" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="jobTitle"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Job title</FormLabel>
                      <FormControl>
                        <Input placeholder="Senior Engineer" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="employmentRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Employment type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full-time">Full-time</SelectItem>
                          <SelectItem value="part-time">Part-time</SelectItem>
                          <SelectItem value="contract">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Status</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="inactive">Inactive</SelectItem>
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
                  name="lineManagerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Line manager</FormLabel>
                      <Select
                        onValueChange={(value) =>
                          field.onChange(
                            value === NO_MANAGER ? undefined : value,
                          )
                        }
                        value={field.value ?? NO_MANAGER}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value={NO_MANAGER}>
                            No line manager
                          </SelectItem>
                          {managersQuery.isLoading && (
                            <SelectItem value="__loading" disabled>
                              Loading…
                            </SelectItem>
                          )}
                          {managers.map((m) => (
                            <SelectItem key={m.uid} value={m.uid}>
                              {m.displayName ?? m.email ?? "Unknown"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {!managersQuery.isLoading && managers.length === 0 && (
                        <FormDescription>
                          No manager accounts yet — create one first.
                        </FormDescription>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            {/* Personal */}
            <section className="space-y-4">
              <SectionLabel>Personal</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="+1 555 010 2030" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="nationalId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>National ID</FormLabel>
                      <FormControl>
                        <Input placeholder="Government ID" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>Address</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Street, city, postal code"
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

            {/* Emergency contact (optional) */}
            <section className="space-y-4">
              <SectionLabel>
                Emergency contact{" "}
                <span className="font-normal text-muted-foreground">
                  (optional)
                </span>
              </SectionLabel>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="emergencyContactName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactPhone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Phone</FormLabel>
                      <FormControl>
                        <Input placeholder="Contact phone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="emergencyContactRelationship"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Relationship</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Spouse" {...field} />
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
              {isEdit ? "Save changes" : "Add employee"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3
      className={cn(
        "text-xs font-semibold uppercase tracking-wider text-muted-foreground",
      )}
    >
      {children}
    </h3>
  );
}
