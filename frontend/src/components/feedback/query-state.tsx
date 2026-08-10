import type { ReactNode } from "react";

import { EmptyState } from "@/components/empty-state";
import { PageError } from "@/components/feedback/page-error";
import { PageLoader } from "@/components/feedback/page-loader";
import { getErrorMessage } from "@/lib/api";
import { Inbox } from "lucide-react";

/*
 * QueryState — the shared "four states" wrapper for any data-driven view.
 *
 *   loading → skeleton
 *   error   → friendly error panel + retry (wired to `refetch`)
 *   empty   → EmptyState (default when data is an empty array)
 *   success → children(data)
 *
 * Pass a render-prop `children` so the resolved data type flows to the view
 * without casts. Override `loading`/`empty`/`isEmpty` per page as needed.
 */

interface QueryStateProps<T> {
  data: T | undefined;
  isLoading: boolean;
  isError: boolean;
  error?: unknown;
  /** TanStack Query refetch — passed straight to the retry button. */
  refetch?: () => void;
  /** Custom emptiness predicate (defaults to "empty array"). */
  isEmpty?: (data: T) => boolean;
  /** Custom loading node (defaults to <PageLoader />). */
  loading?: ReactNode;
  /** Custom empty node (defaults to a generic EmptyState). */
  empty?: ReactNode;
  children: (data: T) => ReactNode;
}

function isListEmpty<T>(data: T): boolean {
  return Array.isArray(data) && data.length === 0;
}

export function QueryState<T>({
  data,
  isLoading,
  isError,
  error,
  refetch,
  isEmpty,
  loading,
  empty,
  children,
}: QueryStateProps<T>) {
  // Check error BEFORE loading/undefined: when a query fails, TanStack keeps
  // `data` as undefined, so `data === undefined` alone must not render a loader
  // forever. (isLoading and isError are mutually exclusive in Query v5.)
  if (isError) {
    return (
      <PageError
        message={getErrorMessage(error)}
        onRetry={refetch ? () => void refetch() : undefined}
      />
    );
  }

  if (isLoading || data === undefined) {
    return <>{loading ?? <PageLoader />}</>;
  }

  const isEmptyResult = (isEmpty ?? isListEmpty)(data);
  if (isEmptyResult) {
    return (
      <>
        {empty ?? (
          <div className="rounded-lg border border-dashed border-border bg-card/50">
            <EmptyState
              icon={Inbox}
              title="Nothing here yet"
              description="When there's data to show, it will appear here."
            />
          </div>
        )}
      </>
    );
  }

  return <>{children(data)}</>;
}
