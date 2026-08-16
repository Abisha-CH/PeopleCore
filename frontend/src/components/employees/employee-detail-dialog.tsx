import {
  BriefcaseBusiness,
  CalendarDays,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Siren,
  UserRound,
} from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmployeeStatusBadge } from "@/components/status-badge";
import { avatarToneClass, formatDate, getInitials, lineManagerLabel } from "@/lib/format";
import type { EmployeeRecord } from "@/lib/types";
import { cn } from "@/lib/utils";

/*
 * EmployeeDetailDialog — read-only view of a full employee record.
 * Used from the row menu on the Employees page.
 */

interface EmployeeDetailDialogProps {
  employee: EmployeeRecord | null;
  onOpenChange: (open: boolean) => void;
}

const EMPLOYMENT_ROLE_LABELS: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
};

function DetailRow({
  label,
  value,
  children,
}: {
  label: string;
  value?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="py-2.5 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-3">
      <dt className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-0.5 text-sm text-foreground sm:col-span-2 sm:mt-0">
        {children ?? value ?? "—"}
      </dd>
    </div>
  );
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-1.5 px-1 pt-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  );
}

export function EmployeeDetailDialog({
  employee,
  onOpenChange,
}: EmployeeDetailDialogProps) {
  if (!employee) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        {/* Hero header */}
        <div className="relative -mx-6 -mt-6 overflow-hidden rounded-t-xl bg-gradient-to-br from-indigo-600 via-brand-600 to-sky-500 px-6 pb-10 pt-6">
          <div
            className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/10 blur-2xl"
            aria-hidden="true"
          />
          <div
            className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-teal-300/20 blur-2xl"
            aria-hidden="true"
          />
          <DialogHeader className="relative">
            <div className="flex items-center gap-4">
              <Avatar className="h-14 w-14 ring-4 ring-white/25">
                <AvatarFallback
                  className={cn("text-base", avatarToneClass(employee.fullName))}
                >
                  {getInitials(employee.fullName)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <DialogTitle className="text-xl font-semibold text-white">
                  {employee.fullName}
                </DialogTitle>
                <DialogDescription className="mt-0.5 truncate text-sm text-white/80">
                  {employee.jobTitle}
                  {employee.department ? ` · ${employee.department}` : ""}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Identity chips */}
        <div className="-mt-6 flex flex-wrap items-center gap-2">
          <Badge variant="neutral" className="bg-card shadow-card">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {EMPLOYMENT_ROLE_LABELS[employee.employmentRole] ??
              employee.employmentRole}
          </Badge>
          <EmployeeStatusBadge status={employee.status} />
        </div>

        {/* Contact */}
        <section className="space-y-1">
          <GroupHeading>
            <UserRound className="h-3.5 w-3.5" aria-hidden="true" />
            Contact
          </GroupHeading>
          <dl className="divide-y divide-border border-y border-border">
            <DetailRow label="Email">
              <span className="inline-flex items-center gap-1.5">
                <Mail
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {employee.email}
              </span>
            </DetailRow>
            <DetailRow label="Phone">
              <span className="inline-flex items-center gap-1.5">
                <Phone
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {employee.phone}
              </span>
            </DetailRow>
            <DetailRow label="Address">
              <span className="inline-flex items-start gap-1.5">
                <MapPin
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                {employee.address}
              </span>
            </DetailRow>
          </dl>
        </section>

        {/* Employment */}
        <section className="space-y-1">
          <GroupHeading>
            <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
            Employment
          </GroupHeading>
          <dl className="divide-y divide-border border-y border-border">
            <DetailRow label="Start date">
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {formatDate(employee.startDate)}
              </span>
            </DetailRow>
            <DetailRow label="National ID">{employee.nationalId}</DetailRow>
            <DetailRow label="Line manager">
              <span className="inline-flex items-center gap-1.5">
                <UserRound
                  className="h-3.5 w-3.5 text-muted-foreground"
                  aria-hidden="true"
                />
                {lineManagerLabel(employee)}
              </span>
            </DetailRow>
          </dl>
        </section>

        {/* Emergency contact */}
        <section className="space-y-1">
          <GroupHeading>
            <Siren className="h-3.5 w-3.5" aria-hidden="true" />
            Emergency contact
          </GroupHeading>
          {employee.emergencyContact ? (
            <dl className="divide-y divide-border border-y border-border">
              <DetailRow label="Name">{employee.emergencyContact.name}</DetailRow>
              <DetailRow label="Relationship">
                {employee.emergencyContact.relationship}
              </DetailRow>
              <DetailRow label="Phone">
                {employee.emergencyContact.phone}
              </DetailRow>
            </dl>
          ) : (
            <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
              No emergency contact on file.
            </p>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}