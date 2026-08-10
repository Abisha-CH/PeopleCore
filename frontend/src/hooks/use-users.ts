import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type { Role } from "@/lib/types";

/*
 * User directory — used to populate the line-manager dropdown in the
 * employee form. Backed by GET /api/auth/users.
 */

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  role: Role | null;
}

export interface UsersResponse {
  users: AuthUser[];
  total: number;
}

export const userKeys = {
  all: ["auth-users"] as const,
  list: (role?: string) => ["auth-users", role ?? "all"] as const,
};

export function useUsers(role?: "manager") {
  return useQuery({
    queryKey: userKeys.list(role),
    queryFn: () =>
      api.get<UsersResponse>(
        `/auth/users${role ? `?role=${encodeURIComponent(role)}` : ""}`,
      ),
    staleTime: 5 * 60 * 1000,
  });
}
