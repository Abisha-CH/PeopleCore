import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";

import { useAuth } from "@/providers/auth-provider";
import type { Role } from "@/lib/auth";

export function RoleGuard({
  roles,
  children,
}: {
  roles: Role[];
  children: ReactNode;
}) {
  const { role } = useAuth();

  if (role && !roles.includes(role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
