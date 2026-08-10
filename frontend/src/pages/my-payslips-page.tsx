import { useMemo, useState } from "react";
import {
  CircleDollarSign,
  Eye,
  MoreHorizontal,
  ReceiptText,
  Search,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Pagination } from "@/components/ui/pagination";
import { PayslipStatusBadge } from "@/components/status-badge";
import { PayslipDetailDialog } from "@/components/payroll/payslip-detail-dialog";
import { EmptyState } from "@/components/empty-state";
import { usePayslips } from "@/hooks/use-payroll";
import {
  formatCurrency,
  formatDateTime,
  monthYearLabel,
} from "@/lib/format";
import { useAuth } from "@/providers/auth-provider";
import type { Payslip } from "@/lib/types";

/*
 * MyPayslipsPage — employee view of their own published payslips.
 *
 * The backend automatically scopes the list to the authenticated employee's
 * own published payslips, so no filter parameters are needed. A detail dialog
 * reuses the shared PayslipDetailDialog (same as the admin Payroll page).
 */

const PAGE_SIZE = 10;

export function MyPayslipsPage() {
  const { displayName } = useAuth();
  const [page, setPage] = useState(1);
  const [detailTarget, setDetailTarget] = useState<Payslip | null>(null);

  const payslipsQuery = usePayslips();

  const payslips = useMemo(
    () => payslipsQuery.data?.payslips ?? [],
    [payslipsQuery.data],
  );

  const totalNet = useMemo(
    () => payslips.reduce((sum, p) => sum + p.netSalary, 0),
    [payslips],
  );

  const totalDeductions = useMemo(
    () =>
      payslips.reduce(
        (sum, p) => sum + (p.baseSalary - p.netSalary),
        0,
      ),
    [payslips],
  );

  const payslipCount = payslips.length;

  const pageData = payslips.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Payslips"
        description="Your published payslip history."
      />

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={Wallet}
          value={formatCurrency(totalNet)}
          label="Total net pay"
          tone="teal"
        />
        <StatCard
          icon={CircleDollarSign}
          value={formatCurrency(totalDeductions)}
          label="Total deductions"
          tone="warning"
        />
        <StatCard
          icon={ReceiptText}
          value={payslipCount}
          label="Payslips"
          tone="sky"
        />
      </div>

      {/* Table */}
      <QueryState
        data={payslipsQuery.data}
        isLoading={payslipsQuery.isLoading}
        isError={payslipsQuery.isError}
        error={payslipsQuery.error}
        refetch={() => void payslipsQuery.refetch()}
        isEmpty={(d) => d.payslips.length === 0}
        empty={
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={ReceiptText}
              title="No payslips yet"
              description="Your published payslips will appear here once payroll runs."
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
                    <TableHead>Period</TableHead>
                    <TableHead className="hidden md:table-cell">Status</TableHead>
                    <TableHead className="hidden md:table-cell text-right">Base salary</TableHead>
                    <TableHead className="text-right">Net pay</TableHead>
                    <TableHead className="hidden lg:table-cell">Generated</TableHead>
                    <TableHead className="w-[48px]">
                      <span className="sr-only">Actions</span>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payslips.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6}>
                        <EmptyState
                          icon={Search}
                          title="No payslips"
                          description="Published payslips will appear here."
                          tone="muted"
                        />
                      </TableCell>
                    </TableRow>
                  ) : (
                    pageData.map((payslip) => (
                      <TableRow key={payslip.payslipId}>
                        <TableCell>
                          <span className="text-sm font-medium text-foreground">
                            {monthYearLabel(payslip.month, payslip.year)}
                          </span>
                        </TableCell>
                        <TableCell className="hidden md:table-cell">
                          <PayslipStatusBadge status={payslip.status} />
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-right text-sm tabular-nums text-muted-foreground">
                          {formatCurrency(payslip.baseSalary)}
                        </TableCell>
                        <TableCell className="text-right text-sm font-semibold text-teal-700 tabular-nums">
                          {formatCurrency(payslip.netSalary)}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {formatDateTime(payslip.generatedAt)}
                        </TableCell>
                        <TableCell>
                          <RowActions
                            payslip={payslip}
                            onView={setDetailTarget}
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
              total={payslips.length}
              onPageChange={setPage}
            />
          </>
        )}
      </QueryState>

      {/* Detail dialog */}
      <PayslipDetailDialog
        payslip={detailTarget}
        employeeName={displayName ?? undefined}
        onOpenChange={(open) => {
          if (!open) setDetailTarget(null);
        }}
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Row actions dropdown                                                        */
/* -------------------------------------------------------------------------- */

function RowActions({
  payslip,
  onView,
}: {
  payslip: Payslip;
  onView: (payslip: Payslip) => void;
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
        <DropdownMenuItem onClick={() => onView(payslip)}>
          <Eye className="h-4 w-4" />
          View payslip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
