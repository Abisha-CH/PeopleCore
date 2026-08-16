import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/*
 * PageError — full-width error state for a page whose data failed to load.
 * Pairs with a TanStack Query `refetch` for a one-click retry.
 */

interface PageErrorProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  /** Extra context (e.g. a support hint) shown beneath the message. */
  hint?: ReactNode;
}

export function PageError({
  title = "Couldn't load this page",
  message = "Something went wrong while fetching data. Please try again.",
  onRetry,
  hint,
}: PageErrorProps) {
  return (
    <div
      role="alert"
      className="flex min-h-[50vh] w-full items-center justify-center p-8"
    >
      <div className="w-full max-w-md rounded-xl border border-border/80 bg-card p-8 text-center shadow-card">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-6 w-6 text-destructive" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {message}
        </p>
        {hint && <div className="mt-3 text-sm text-muted-foreground">{hint}</div>}
        {onRetry && (
          <div className="mt-6">
            <Button onClick={onRetry} variant="outline">
              <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Try again
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
