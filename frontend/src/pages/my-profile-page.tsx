import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Mail, MapPin, Pencil, Phone, ShieldCheck } from "lucide-react";
import { z } from "zod";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { EmployeeStatusBadge } from "@/components/status-badge";
import { useEmployee, useUpdateOwnPhone } from "@/hooks/use-employees";
import { formatDate, getInitials } from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { EmployeeRecord } from "@/lib/types";

/*
 * MyProfilePage — an employee's view of their own record.
 *
 * Everything is read-only except the phone number, which is the only
 * self-service field the backend allows. The line manager shows as
 * "Assigned"/"Not assigned" because non-admin users cannot resolve other
 * employee records to a name.
 */

const EMPLOYMENT_ROLE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
};

export function MyProfilePage() {
  const { user } = useAuth();
  const employeeId = user?.uid ?? null;

  const profileQuery = useEmployee(employeeId);
  const [phoneOpen, setPhoneOpen] = useState(false);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Your personal and employment details."
      />

      <QueryState
        data={profileQuery.data}
        isLoading={profileQuery.isLoading}
        isError={profileQuery.isError}
        error={profileQuery.error}
        refetch={() => void profileQuery.refetch()}
      >
        {({ employee }) => (
          <>
            <IdentityCard employee={employee} />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Personal information */}
              <Card>
                <CardHeader>
                  <CardTitle>Personal information</CardTitle>
                  <CardDescription>
                    Your contact details and identification on file.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border border-t border-border">
                    <ProfileRow label="Email">
                      <span className="inline-flex items-center gap-1.5">
                        <Mail
                          className="h-3.5 w-3.5 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {employee.email}
                      </span>
                    </ProfileRow>
                    <ProfileRow label="Phone">
                      <span className="flex items-center justify-between gap-3">
                        <span className="inline-flex items-center gap-1.5">
                          <Phone
                            className="h-3.5 w-3.5 text-muted-foreground"
                            aria-hidden="true"
                          />
                          {employee.phone}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPhoneOpen(true)}
                          className="shrink-0"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                          Edit
                        </Button>
                      </span>
                    </ProfileRow>
                    <ProfileRow label="National ID">
                      {employee.nationalId}
                    </ProfileRow>
                    <ProfileRow label="Address">
                      <span className="inline-flex items-start gap-1.5">
                        <MapPin
                          className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                          aria-hidden="true"
                        />
                        {employee.address}
                      </span>
                    </ProfileRow>
                  </dl>
                </CardContent>
              </Card>

              {/* Employment details */}
              <Card>
                <CardHeader>
                  <CardTitle>Employment details</CardTitle>
                  <CardDescription>
                    Your role and record with the company.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="divide-y divide-border border-t border-border">
                    <ProfileRow label="Department">
                      {employee.department}
                    </ProfileRow>
                    <ProfileRow label="Job title">{employee.jobTitle}</ProfileRow>
                    <ProfileRow label="Employment type">
                      {EMPLOYMENT_ROLE_LABELS[employee.employmentRole] ??
                        employee.employmentRole}
                    </ProfileRow>
                    <ProfileRow label="Start date">
                      {formatDate(employee.startDate)}
                    </ProfileRow>
                    <ProfileRow label="Status">
                      <EmployeeStatusBadge status={employee.status} />
                    </ProfileRow>
                    <ProfileRow label="Line manager">
                      {employee.lineManagerId ? "Assigned" : "Not assigned"}
                    </ProfileRow>
                  </dl>
                </CardContent>
              </Card>
            </div>

            {/* Emergency contact */}
            <Card>
              <CardHeader>
                <CardTitle>Emergency contact</CardTitle>
                <CardDescription>
                  Who we can reach in an emergency.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {employee.emergencyContact ? (
                  <div className="grid gap-4 sm:grid-cols-3">
                    <ContactField
                      label="Name"
                      value={employee.emergencyContact.name}
                    />
                    <ContactField
                      label="Relationship"
                      value={employee.emergencyContact.relationship}
                    />
                    <ContactField
                      label="Phone"
                      value={employee.emergencyContact.phone}
                    />
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No emergency contact on file.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </QueryState>

      {/* Phone edit dialog */}
      {profileQuery.data && (
        <PhoneEditDialog
          open={phoneOpen}
          employeeId={profileQuery.data.employee.employeeId}
          currentPhone={profileQuery.data.employee.phone}
          onOpenChange={setPhoneOpen}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Profile identity card                                                       */
/* -------------------------------------------------------------------------- */

function IdentityCard({ employee }: { employee: EmployeeRecord }) {
  return (
    <Card className="overflow-hidden">
      <div className="h-24 bg-gradient-to-br from-brand-50 via-slate-50 to-teal-50" />
      <CardContent className="pt-0">
        <div className="-mt-12 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-4">
            <Avatar className="h-20 w-20 ring-4 ring-background">
              <AvatarFallback className="text-lg">
                {getInitials(employee.fullName)}
              </AvatarFallback>
            </Avatar>
            <div className="pb-0.5">
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {employee.fullName}
              </h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {employee.jobTitle} · {employee.department}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pb-0.5">
            <Badge variant="neutral">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {EMPLOYMENT_ROLE_LABELS[employee.employmentRole] ??
                employee.employmentRole}
            </Badge>
            <EmployeeStatusBadge status={employee.status} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared building blocks                                                      */
/* -------------------------------------------------------------------------- */

function ProfileRow({
  label,
  children,
}: {
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground sm:col-span-2 sm:mt-0">
        {children ?? "—"}
      </dd>
    </div>
  );
}

function ContactField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/40 p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Phone edit dialog                                                           */
/* -------------------------------------------------------------------------- */

const phoneSchema = z.object({
  phone: z.string().trim().min(1, "Phone number is required."),
});

type PhoneFormValues = z.infer<typeof phoneSchema>;

interface PhoneEditDialogProps {
  open: boolean;
  employeeId: string;
  currentPhone: string;
  onOpenChange: (open: boolean) => void;
}

function PhoneEditDialog({
  open,
  employeeId,
  currentPhone,
  onOpenChange,
}: PhoneEditDialogProps) {
  const updatePhone = useUpdateOwnPhone();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && (
        <PhoneEditBody
          currentPhone={currentPhone}
          isSubmitting={updatePhone.isPending}
          onDone={() => onOpenChange(false)}
          onSubmit={(phone) =>
            updatePhone.mutate(
              { employeeId, phone },
              { onSuccess: () => onOpenChange(false) },
            )
          }
        />
      )}
    </Dialog>
  );
}

function PhoneEditBody({
  currentPhone,
  isSubmitting,
  onDone,
  onSubmit,
}: {
  currentPhone: string;
  isSubmitting: boolean;
  onDone: () => void;
  onSubmit: (phone: string) => void;
}) {
  const form = useForm<PhoneFormValues>({
    resolver: zodResolver(phoneSchema),
    defaultValues: { phone: currentPhone },
    mode: "onBlur",
  });

  return (
    <DialogContent className="max-w-md">
      <DialogHeader>
        <DialogTitle>Edit phone number</DialogTitle>
        <DialogDescription>
          Your phone number is shown to your manager and used for emergency
          contact.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((values) => onSubmit(values.phone))}
          noValidate
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="+1 (555) 000-0000" {...field} />
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
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );
}
