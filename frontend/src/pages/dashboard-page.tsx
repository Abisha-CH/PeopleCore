import { Link } from "react-router-dom";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  FileText,
  ReceiptText,
  Settings2,
  Users,
  UserRound,
  Wallet,
} from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { QueryState } from "@/components/feedback/query-state";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/empty-state";
import { LeaveStatusBadge, PayslipStatusBadge } from "@/components/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useDashboard } from "@/hooks/use-dashboard";
import { formatDateRange, monthYearLabel } from "@/lib/format";
import type {
  AdminDashboard,
  EmployeeDashboard,
  LeaveRequest,
  ManagerDashboard,
} from "@/lib/types";
import { useAuth } from "@/providers/auth-provider";
import { cn } from "@/lib/utils";

/*
 * Dashboard — role-aware landing page.
 *
 * The backend returns a different payload per role, so each role gets its own
 * view. Everything hangs off one `useDashboard()` query; loading/error/empty
 * handling is shared through <QueryState>.
 */

/* -------------------------------------------------------------------------- */
/* Quick-action card (shared)                                                  */
/* -------------------------------------------------------------------------- */

interface QuickAction {
  to: string;
  icon: typeof Users;
  label: string;
  description: string;
}

function QuickActions({
  title,
  actions,
}: {
  title: string;
  actions: QuickAction[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>Jump straight into what you need.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {actions.map(({ to, icon: Icon, label, description }) => (
            <Link
              key={to}
              to={to}
              className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-100">
                <Icon className="h-4.5 w-4.5" aria-hidden="true" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                  {label}
                  <ArrowUpRight
                    className="h-3.5 w-3.5 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-600"
                    aria-hidden="true"
                  />
                </span>
                <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                  {description}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Attention list (admin)                                                      */
/* -------------------------------------------------------------------------- */

interface AttentionItem {
  to: string;
  label: string;
  count: number;
  hint: string;
}

function AttentionList({ items }: { items: AttentionItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Needs your attention</CardTitle>
        <CardDescription>Items waiting on the admin team.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {items.map(({ to, label, count, hint }) => (
            <li key={label}>
              <Link
                to={to}
                className="group flex items-center justify-between gap-4 rounded-lg border border-border bg-card p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                <span className="min-w-0">
                  <span className="text-sm font-medium text-foreground">
                    {label}
                  </span>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {hint}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-2">
                  {count > 0 ? (
                    <Badge variant="warning">{count}</Badge>
                  ) : (
                    <Badge variant="success">All clear</Badge>
                  )}
                  <ArrowRight
                    className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                    aria-hidden="true"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Admin view                                                                  */
/* -------------------------------------------------------------------------- */

function AdminDashboardView({ data }: { data: AdminDashboard }) {
  const attentionItems: AttentionItem[] = [
    {
      to: "/leave",
      label: "Leave awaiting final approval",
      count: data.managerApprovedLeaveCount,
      hint: "Requests your line-manager already approved — confirm or reject.",
    },
    {
      to: "/payroll",
      label: "Draft payslips",
      count: data.draftPayslipCount,
      hint: "Generated but not yet published to employees.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={Users}
          tone="brand"
          value={data.activeHeadcount}
          label="Active employees"
        />
        <StatCard
          icon={ClipboardCheck}
          tone="teal"
          value={data.managerApprovedLeaveCount}
          label="Awaiting final approval"
        />
        <StatCard
          icon={ReceiptText}
          tone="sky"
          value={data.draftPayslipCount}
          label="Draft payslips"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AttentionList items={attentionItems} />
        <QuickActions
          title="Admin shortcuts"
          actions={[
            {
              to: "/employees",
              icon: Users,
              label: "Employees",
              description: "View the team, edit records, provision access.",
            },
            {
              to: "/leave",
              icon: CalendarRange,
              label: "Leave management",
              description: "Review, approve or reject leave requests.",
            },
            {
              to: "/payroll",
              icon: Wallet,
              label: "Payroll",
              description: "Manage pay profiles and publish payslips.",
            },
            {
              to: "/leave-settings",
              icon: Settings2,
              label: "Leave settings",
              description: "Leave types, entitlements and public holidays.",
            },
          ]}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Manager view                                                                */
/* -------------------------------------------------------------------------- */

function ManagerDashboardView({ data }: { data: ManagerDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard
          icon={ClipboardCheck}
          tone="warning"
          value={data.pendingDirectReportLeaveCount}
          label="Leave requests awaiting your review"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {data.pendingDirectReportLeaveCount > 0 ? (
          <Card className="border-warning/30 bg-warning-50/40">
            <CardHeader>
              <CardTitle>Review queue</CardTitle>
              <CardDescription>
                You have {data.pendingDirectReportLeaveCount} request
                {data.pendingDirectReportLeaveCount === 1 ? "" : "s"} from your
                team waiting on a decision.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                to="/leave-approvals"
                className="inline-flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
              >
                Open leave approvals
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <EmptyState
                icon={ClipboardCheck}
                title="You're all caught up"
                description="No leave requests are waiting on your review right now."
              />
            </CardContent>
          </Card>
        )}

        <QuickActions
          title="Personal shortcuts"
          actions={[
            {
              to: "/my-leave",
              icon: CalendarDays,
              label: "My leave",
              description: "Request time off and check your balance.",
            },
            {
              to: "/my-payslips",
              icon: ReceiptText,
              label: "My payslips",
              description: "View and download your latest payslips.",
            },
            {
              to: "/my-profile",
              icon: UserRound,
              label: "My profile",
              description: "Review your details and contact information.",
            },
          ]}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Employee view                                                               */
/* -------------------------------------------------------------------------- */

function EmployeeDashboardView({ data }: { data: EmployeeDashboard }) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Leave balances */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Leave balance</CardTitle>
              <CardDescription>
                How much time off you have left this year.
              </CardDescription>
            </div>
            <Link
              to="/my-leave"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              Request leave
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.leaveBalances.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="No entitlements yet"
                description="Leave balances will appear here once your entitlements are set up."
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.leaveBalances.map((balance) => (
                  <li
                    key={balance.leaveTypeId}
                    className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                  >
                    <span className="text-sm text-foreground">
                      {balance.name}
                    </span>
                    <span className="flex items-baseline gap-1.5">
                      <span
                        className={cn(
                          "text-lg font-semibold tabular-nums tracking-tight",
                          balance.balance <= 0
                            ? "text-muted-foreground"
                            : "text-foreground",
                        )}
                      >
                        {balance.balance}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        days left
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Latest payslip */}
        <Card>
          <CardHeader>
            <CardTitle>Latest payslip</CardTitle>
            <CardDescription>Your most recent pay period.</CardDescription>
          </CardHeader>
          <CardContent className="flex h-full flex-col justify-between gap-6">
            {data.latestPayslip ? (
              <>
                <div className="space-y-3">
                  <div>
                    <p className="text-2xl font-semibold tracking-tight text-foreground">
                      {monthYearLabel(
                        data.latestPayslip.month,
                        data.latestPayslip.year,
                      )}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Payslip for this period
                    </p>
                  </div>
                  <div>
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Status
                    </span>
                    <div className="mt-1.5">
                      <PayslipStatusBadge status={data.latestPayslip.status} />
                    </div>
                  </div>
                </div>
                <Link
                  to="/my-payslips"
                  className="inline-flex items-center gap-2 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  View all payslips
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </>
            ) : (
              <EmptyState
                icon={ReceiptText}
                title="No payslips yet"
                description="Your payslips will show up here once payroll runs."
              />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Pending requests */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Pending leave requests</CardTitle>
              <CardDescription>
                Time off you've requested that is still in review.
              </CardDescription>
            </div>
            <Link
              to="/my-leave"
              className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </CardHeader>
          <CardContent>
            {data.pendingLeaveRequests.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="No pending requests"
                description="Requests you submit will appear here until they're decided."
              />
            ) : (
              <ul className="divide-y divide-border">
                {data.pendingLeaveRequests.map((request) => (
                  <PendingRequestRow key={request.leaveRequestId} request={request} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <QuickActions
          title="Quick links"
          actions={[
            {
              to: "/my-leave",
              icon: CalendarDays,
              label: "My leave",
              description: "Request time off and track your balance.",
            },
            {
              to: "/my-payslips",
              icon: ReceiptText,
              label: "My payslips",
              description: "Browse your payslip history.",
            },
            {
              to: "/my-profile",
              icon: UserRound,
              label: "My profile",
              description: "Keep your contact details up to date.",
            },
          ]}
        />
      </div>
    </div>
  );
}

/** Compact row for a pending leave request inside the employee dashboard. */
function PendingRequestRow({ request }: { request: LeaveRequest }) {
  return (
    <li className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground">
          {formatDateRange(request.startDate, request.endDate, request.isHalfDay)}
        </p>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {request.numberOfDays} day{request.numberOfDays === 1 ? "" : "s"}
        </p>
      </div>
      <LeaveStatusBadge status={request.status} />
    </li>
  );
}

/* -------------------------------------------------------------------------- */
/* Page                                                                        */
/* -------------------------------------------------------------------------- */

export function DashboardPage() {
  const { role, displayName } = useAuth();
  const dashboard = useDashboard();

  const titles: Record<string, { title: string; description: string }> = {
    admin: {
      title: "Overview",
      description: "A snapshot of what's happening across the company.",
    },
    manager: {
      title: "Overview",
      description: "A snapshot of your team's activity.",
    },
    employee: {
      title: "Overview",
      description: "A snapshot of your leave and pay.",
    },
  };

  const heading = titles[role ?? "employee"];

  return (
    <div className="space-y-8">
      <PageHeader
        title={
          displayName
            ? `Welcome back, ${displayName.split(" ")[0]}`
            : heading.title
        }
        description={heading.description}
      />

      <QueryState
        data={dashboard.data?.dashboard}
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        error={dashboard.error}
        refetch={() => void dashboard.refetch()}
      >
        {(data) => {
          if (role === "admin") {
            return <AdminDashboardView data={data as AdminDashboard} />;
          }
          if (role === "manager") {
            return <ManagerDashboardView data={data as ManagerDashboard} />;
          }
          return <EmployeeDashboardView data={data as EmployeeDashboard} />;
        }}
      </QueryState>
    </div>
  );
}
