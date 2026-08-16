import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

/*
 * Loading feedback. Skeletons match the approximate shape of the real page
 * (title bar + cards + table rows) so content doesn't "jump" when it arrives.
 * The container is marked aria-busy so assistive tech knows to wait.
 */

interface PageLoaderProps {
  /** Visually distinguish a page-level load (title bar) vs an in-card load. */
  variant?: "page" | "card";
  /** Number of skeleton rows to render inside the card body. */
  rows?: number;
  className?: string;
}

export function PageLoader({
  variant = "page",
  rows = 5,
  className,
}: PageLoaderProps) {
  return (
    <div
      className={cn("space-y-6", className)}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">Loading…</span>

      {variant === "page" && (
        <div className="space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
      )}

      <div className="rounded-xl border border-border/80 bg-card p-6 shadow-card">
        <div className="flex items-center justify-between gap-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
        <div className="mt-6 space-y-4">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-24 shrink-0" />
              <Skeleton className="h-4 w-16 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact row-level placeholder for inside an already-mounted table. */
export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-border/70" aria-busy="true" role="status">
      <span className="sr-only">Loading rows…</span>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-6 py-4">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-full max-w-[160px]" />
          <Skeleton className="ml-auto h-6 w-20 rounded-full" />
        </div>
      ))}
    </div>
  );
}
