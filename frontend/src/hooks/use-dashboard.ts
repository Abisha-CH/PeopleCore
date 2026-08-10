import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  AdminDashboard,
  ManagerDashboard,
  EmployeeDashboard,
} from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export const dashboardKeys = {
  dashboard: ["dashboard"] as const,
};

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Returns the role-appropriate dashboard payload. The backend decides the shape
 * from the caller's role, so the generic is widened and narrowed at call sites.
 */
export function useDashboard() {
  return useQuery({
    queryKey: dashboardKeys.dashboard,
    queryFn: () =>
      api.get<{ dashboard: AdminDashboard | ManagerDashboard | EmployeeDashboard }>(
        "/dashboard",
      ),
  });
}
