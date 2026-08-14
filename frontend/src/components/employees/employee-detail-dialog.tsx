import { Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";

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
import { formatDate, getInitials, lineManagerLabel } from "@/lib/format";
import type { EmployeeRecord } from "@/lib/types";

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

export function EmployeeDetailDialog({
  employee,
  onOpenChange,
}: EmployeeDetailDialogProps) {
  if (!employee) return null;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarFallback>
                {getInitials(employee.fullName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-lg">
                {employee.fullName}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {employee.jobTitle} · {employee.department}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="grid gap-1.5 sm:grid-cols-2">
          <Badge variant="neutral">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {EMPLOYMENT_ROLE_LABELS[employee.employmentRole] ?? employee.employmentRole}
          </Badge>
          <div className="justify-self-start sm:justify-self-end">
            <EmployeeStatusBadge status={employee.status} />
          </div>
        </div>

        <dl className="divide-y divide-border border-y border-border">
          <DetailRow label="Email">
            <span className="inline-flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {employee.email}
            </span>
          </DetailRow>
          <DetailRow label="Phone">
            <span className="inline-flex items-center gap-1.5">
              <Phone className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
              {employee.phone}
            </span>
          </DetailRow>
          <DetailRow label="Start date">{formatDate(employee.startDate)}</DetailRow>
          <DetailRow label="National ID">{employee.nationalId}</DetailRow>
          <DetailRow label="Address">
            <span className="inline-flex items-start gap-1.5">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
              {employee.address}
            </span>
          </DetailRow>
          <DetailRow label="Line manager">
            <span className="inline-flex items-center gap-1.5">
              <UserRound
                className="h-3.5 w-3.5 text-muted-foreground"
                aria-hidden="true"
              />
              {lineManagerLabel(employee)}
            </span>
          </DetailRow>
          <DetailRow label="Emergency contact">
            {employee.emergencyContact
              ? `${employee.emergencyContact.name} · ${employee.emergencyContact.relationship} · ${employee.emergencyContact.phone}`
              : "Not set"}
          </DetailRow>
        </dl>
      </DialogContent>
    </Dialog>
  );
}
