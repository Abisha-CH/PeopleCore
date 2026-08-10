import { cn } from "@/lib/utils";

// spec §3.10: animate-pulse bg-slate-100 rounded-md
function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-muted", className)}
      {...props}
    />
  );
}

export { Skeleton };
