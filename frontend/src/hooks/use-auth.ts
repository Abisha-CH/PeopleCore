import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { api, getErrorMessage } from "@/lib/api";

export const authKeys = {
  setupStatus: ["auth", "setup-status"] as const,
  me: ["auth", "me"] as const,
};

/**
 * Whether the workspace has been bootstrapped (an HR Admin account exists).
 * Public endpoint — callable before any account is created. Cached for the
 * whole session and invalidated after a successful setup.
 */
export function useSetupStatus() {
  return useQuery({
    queryKey: authKeys.setupStatus,
    queryFn: () =>
      api.get<{ bootstrapped: boolean }>("/auth/setup-status", {
        public: true,
      }),
    staleTime: Infinity,
    retry: false,
  });
}

/** Create the first HR Admin account during first-run setup. */
export function useSetupWorkspace() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { fullName: string; email: string; password: string }) =>
      api.post<{ uid: string; email: string; role: "admin" }>(
        "/auth/setup",
        payload,
        { public: true },
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: authKeys.setupStatus });
    },
    onError: (err: Error) => {
      toast.error(getErrorMessage(err));
    },
  });
}

/** The verified caller's identity from the backend token. */
export function useMe() {
  return useQuery({
    queryKey: authKeys.me,
    queryFn: () =>
      api.get<{ uid: string; email: string; role: string }>("/auth/me"),
  });
}
