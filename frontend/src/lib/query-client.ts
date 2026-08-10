import { QueryClient } from "@tanstack/react-query";

import { ApiError } from "./api";

/**
 * Only retry transient / server / timeout failures. Client errors (4xx except
 * 408) are not retryable — the server has already told us the request is
 * invalid.
 */
function shouldRetry(failureCount: number, error: Error): boolean {
  if (failureCount >= 2) return false;
  if (error instanceof ApiError && !error.retryable) return false;
  return true;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: shouldRetry,
      refetchOnWindowFocus: false,
    },
  },
});
