import type { HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

/*
 * Kbd — inline keyboard key hint. Used in the search trigger; small,
 * muted, with a hairline border to read as a keycap.
 */
export function Kbd({
  className,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <kbd
      className={cn(
        "pointer-events-none inline-flex h-5 items-center gap-1 rounded border border-border bg-muted/60 px-1.5 font-mono text-[10px] font-medium leading-none text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}
