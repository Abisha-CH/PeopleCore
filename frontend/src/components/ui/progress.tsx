import * as React from "react";
import { cn } from "@/lib/utils";

/*
 * Progress — thin bar used for entitlement usage. `value` is 0–100.
 * Turns amber/red when usage is high so managers spot exhaustion at a glance.
 */
interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number;
  /** At this usage % the bar turns amber. */
  warnFrom?: number;
  /** At this usage % the bar turns red. */
  dangerFrom?: number;
}

function Progress({
  className,
  value = 0,
  warnFrom = 75,
  dangerFrom = 90,
  ...props
}: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));
  const barColor =
    clamped >= dangerFrom
      ? "bg-destructive"
      : clamped >= warnFrom
        ? "bg-warning"
        : "bg-primary";

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-muted", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-all duration-fast", barColor)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

export { Progress };
