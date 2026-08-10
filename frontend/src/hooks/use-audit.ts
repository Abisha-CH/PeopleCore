import { useQuery } from "@tanstack/react-query";

import { api, buildQuery } from "@/lib/api";
import type { AuditLogResponse } from "@/lib/types";

/* -------------------------------------------------------------------------- */
/* Query keys                                                                 */
/* -------------------------------------------------------------------------- */

export const auditKeys = {
  all: ["audit-log"] as const,
  list: (filters?: object) =>
    ["audit-log", "list", filters ?? {}] as const,
};

/* -------------------------------------------------------------------------- */
/* Audit log                                                                  */
/* -------------------------------------------------------------------------- */

export interface AuditLogFilters {
  targetType?: string;
  actorId?: string;
  /** ISO date (YYYY-MM-DD) — server filters entries from this day onward */
  from?: string;
  /** ISO date (YYYY-MM-DD) — server filters entries up to this day */
  to?: string;
  limit?: number;
}

export function useAuditLog(filters?: AuditLogFilters) {
  return useQuery({
    queryKey: auditKeys.list(filters),
    queryFn: () =>
      api.get<AuditLogResponse>(`/audit-log${buildQuery(filters ?? {})}`),
  });
}
