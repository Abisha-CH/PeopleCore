import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * StatCard — compact metric card with a gradient icon chip, primary value,
 * and a label. Used on the dashboard to surface key numbers at a glance.
 * Hover lifts the card slightly; the top hairline is a quiet premium accent.
 */

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  className?: string;
  /** Icon chip tint — brand blue by default, teal/sky/warning/rose for variety. */
  tone?: "brand" | "teal" | "sky" | "warning" | "destructive";
}

const toneStyles: Record<string, string> = {
  brand: "bg-brand-gradient text-white shadow-brand-600/30",
  teal: "bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-teal-600/30",
  sky: "bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sky-600/30",
  warning:
    "bg-gradient-to-br from-warning-500 to-warning-700 text-white shadow-warning-600/30",
  destructive:
    "bg-gradient-to-br from-destructive-500 to-destructive-700 text-white shadow-destructive-600/30",
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
        "group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-card transition-all duration-fast hover:-translate-y-0.5 hover:shadow-card-hover",
        className,
      )}
    >
      <span
        className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-brand-300/60 to-transparent"
        aria-hidden="true"
      />
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-md transition-transform duration-fast group-hover:scale-105",
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