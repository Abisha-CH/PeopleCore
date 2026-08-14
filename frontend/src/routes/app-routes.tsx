import { lazy } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { LoginPage } from "@/components/auth/login-page";
import { SetupPage } from "@/pages/setup-page";
import { ProtectedRoute } from "@/components/auth/protected-route";
import { RoleGuard } from "@/components/auth/role-guard";
import { NotFoundPage } from "@/pages/not-found-page";
import type { Role } from "@/lib/auth";

/*
 * AppRoutes — route table for the app.
 *
 * Feature pages are code-split with React.lazy so each route's bundle is only
 * fetched on first visit. The Suspense fallback lives in AppShell (around the
 * routed <Outlet />), so the sidebar/header stay mounted while a chunk loads.
 * LoginPage and NotFoundPage stay eager: they are small and auth-critical.
 */

const DashboardPage = lazy(() =>
  import("@/pages/dashboard-page").then((m) => ({ default: m.DashboardPage })),
);
const EmployeesPage = lazy(() =>
  import("@/pages/employees-page").then((m) => ({ default: m.EmployeesPage })),
);
const LeaveManagementPage = lazy(() =>
  import("@/pages/leave-management-page").then((m) => ({
    default: m.LeaveManagementPage,
  })),
);
const LeaveSettingsPage = lazy(() =>
  import("@/pages/leave-settings-page").then((m) => ({
    default: m.LeaveSettingsPage,
  })),
);
const PayrollPage = lazy(() =>
  import("@/pages/payroll-page").then((m) => ({ default: m.PayrollPage })),
);
const AuditLogPage = lazy(() =>
  import("@/pages/audit-log-page").then((m) => ({ default: m.AuditLogPage })),
);
const LeaveApprovalsPage = lazy(() =>
  import("@/pages/leave-approvals-page").then((m) => ({
    default: m.LeaveApprovalsPage,
  })),
);
const MyLeavePage = lazy(() =>
  import("@/pages/my-leave-page").then((m) => ({ default: m.MyLeavePage })),
);
const MyProfilePage = lazy(() =>
  import("@/pages/my-profile-page").then((m) => ({ default: m.MyProfilePage })),
);
const MyPayslipsPage = lazy(() =>
  import("@/pages/my-payslips-page").then((m) => ({ default: m.MyPayslipsPage })),
);

function guard(roles: Role[], element: React.ReactNode) {
  return <RoleGuard roles={roles}>{element}</RoleGuard>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/setup" element={<SetupPage />} />

      <Route element={<ProtectedRoute />}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />

        {/* HR Admin only */}
        <Route path="/employees" element={guard(["admin"], <EmployeesPage />)} />
        <Route path="/leave" element={guard(["admin"], <LeaveManagementPage />)} />
        <Route path="/leave-settings" element={guard(["admin"], <LeaveSettingsPage />)} />
        <Route path="/payroll" element={guard(["admin"], <PayrollPage />)} />
        <Route path="/audit-log" element={guard(["admin"], <AuditLogPage />)} />

        {/* Line Manager only */}
        <Route path="/leave-approvals" element={guard(["manager"], <LeaveApprovalsPage />)} />

        {/* All roles */}
        <Route path="/my-leave" element={<MyLeavePage />} />
        <Route path="/my-profile" element={<MyProfilePage />} />
        <Route path="/my-payslips" element={<MyPayslipsPage />} />

        {/* 404 inside the shell so authenticated users keep nav context */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
