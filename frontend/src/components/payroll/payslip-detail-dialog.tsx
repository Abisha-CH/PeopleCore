import { Banknote, CircleDollarSign, ReceiptText } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PayslipStatusBadge } from "@/components/status-badge";
import {
  formatCurrency,
  formatDateTime,
  getInitials,
  monthYearLabel,
} from "@/lib/format";
import type { Payslip } from "@/lib/types";

/*
 * PayslipDetailDialog — read-only breakdown of a payslip.
 * Shared by the admin (Payroll) and employee (My Payslips) pages.
 */

interface PayslipDetailDialogProps {
  payslip: Payslip | null;
  employeeName?: string;
  onOpenChange: (open: boolean) => void;
}

function Fact({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground tabular-nums">
        {value}
      </dd>
    </div>
  );
}

export function PayslipDetailDialog({
  payslip,
  employeeName,
  onOpenChange,
}: PayslipDetailDialogProps) {
  if (!payslip) return null;

  const totalDeductions = payslip.deductions.reduce(
    (sum, d) => sum + d.amount,
    0,
  );

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <Avatar className="h-11 w-11">
              <AvatarFallback>{getInitials(employeeName)}</AvatarFallback>
            </Avatar>
            <div>
              <DialogTitle className="text-lg">
                {employeeName ?? "Employee"}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                {monthYearLabel(payslip.month, payslip.year)} payslip
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <PayslipStatusBadge status={payslip.status} />
          {payslip.generatedAt && (
            <Badge variant="neutral">
              Generated {formatDateTime(payslip.generatedAt)}
            </Badge>
          )}
        </div>

        {/* Earnings summary */}
        <section className="rounded-lg border border-border bg-muted/40">
          <h3 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <ReceiptText className="h-3.5 w-3.5" aria-hidden="true" />
            Summary
          </h3>
          <dl className="divide-y divide-border px-4">
            <Fact label="Base salary" value={formatCurrency(payslip.baseSalary)} />
            <Fact
              label="Total deductions"
              value={`− ${formatCurrency(totalDeductions)}`}
            />
            <div className="flex items-center justify-between gap-4 py-3">
              <dt className="text-sm font-semibold text-foreground">Net pay</dt>
              <dd className="text-lg font-semibold text-brand-600 tabular-nums">
                {formatCurrency(payslip.netSalary)}
              </dd>
            </div>
          </dl>
        </section>

        {/* Deductions breakdown */}
        <section className="rounded-lg border border-border">
          <h3 className="flex items-center gap-1.5 border-b border-border px-4 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <CircleDollarSign className="h-3.5 w-3.5" aria-hidden="true" />
            Deductions
          </h3>
          {payslip.deductions.length === 0 ? (
            <p className="flex items-center gap-2 px-4 py-6 text-sm text-muted-foreground">
              <Banknote className="h-4 w-4" aria-hidden="true" />
              No deductions on this payslip.
            </p>
          ) : (
            <dl className="divide-y divide-border px-4">
              {payslip.deductions.map((deduction, index) => (
                <div
                  key={`${deduction.label}-${index}`}
                  className="flex items-center justify-between gap-4 py-2.5"
                >
                  <dt className="text-sm text-foreground">{deduction.label}</dt>
                  <dd className="text-sm text-muted-foreground tabular-nums">
                    {formatCurrency(deduction.amount)}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
