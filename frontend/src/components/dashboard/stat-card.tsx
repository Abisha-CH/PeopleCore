import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * StatCard — compact metric card with a tinted icon, primary value, and a
 * label. Used on the dashboard to surface key numbers at a glance.
 */

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  className?: string;
  /** Icon tint — brand blue by default, teal or sky for visual variety. */
  tone?: "brand" | "teal" | "sky" | "warning" | "destructive";
}

const toneStyles: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600",
  teal: "bg-teal-50 text-teal-600",
  sky: "bg-sky-50 text-sky-600",
  warning: "bg-warning-50 text-warning-600",
  destructive: "bg-destructive-50 text-destructive-600",
};

export function StatCard({
  icon: Icon,
  value,
  label,
  className,
  tone = "brand",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-4 rounded-xl border border-border/70 bg-card p-5 shadow-xs",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
          toneStyles[tone],
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold leading-tight tracking-tight text-foreground">
          {value}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}
