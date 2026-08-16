import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/*
 * StatCard — compact metric card with a gradient icon chip, primary value,
 * and a label. Used on the dashboard to surface key numbers at a glance.
 *
 * Each tone pairs a category colour with a soft radial glow and a gradient
 * hairline, so the card reads layered rather than flat. Hover lifts the card
 * and intensifies the accent.
 */

interface StatCardProps {
  icon: LucideIcon;
  value: string | number;
  label: string;
  className?: string;
  /** Icon chip tint — category colours, not decorative variety. */
  tone?:
    | "brand"
    | "violet"
    | "teal"
    | "sky"
    | "warning"
    | "destructive"
    | "success";
}

interface ToneStyle {
  chip: string;
  glow: string;
  hairline: string;
}

const toneStyles: Record<string, ToneStyle> = {
  // Payroll / revenue — PeopleCore blue
  brand: {
    chip: "bg-brand-gradient text-white shadow-brand-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(59_130_246/0.14),transparent_60%)]",
    hairline: "via-brand-400/70",
  },
  // People / employees — violet
  violet: {
    chip: "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(139_92_246/0.16),transparent_60%)]",
    hairline: "via-violet-400/70",
  },
  // Leave — teal/cyan
  teal: {
    chip: "bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-teal-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(20_184_166/0.16),transparent_60%)]",
    hairline: "via-teal-400/70",
  },
  // Informational / secondary — sky
  sky: {
    chip: "bg-gradient-to-br from-sky-500 to-sky-700 text-white shadow-sky-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(56_189_248/0.16),transparent_60%)]",
    hairline: "via-sky-400/70",
  },
  // Awaiting review — amber
  warning: {
    chip: "bg-gradient-to-br from-warning-500 to-warning-700 text-white shadow-warning-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(245_158_11/0.16),transparent_60%)]",
    hairline: "via-warning-400/70",
  },
  // Rejected / risky — rose
  destructive: {
    chip: "bg-gradient-to-br from-destructive-500 to-destructive-700 text-white shadow-destructive-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(239_68_68/0.14),transparent_60%)]",
    hairline: "via-destructive-400/70",
  },
  // Positive — emerald
  success: {
    chip: "bg-gradient-to-br from-success-500 to-success-700 text-white shadow-success-600/30",
    glow: "bg-[radial-gradient(circle_at_20%_10%,rgb(34_197_94/0.14),transparent_60%)]",
    hairline: "via-success-400/70",
  },
};

export function StatCard({
  icon: Icon,
  value,
  label,
  className,
  tone = "brand",
}: StatCardProps) {
  const style = toneStyles[tone] ?? toneStyles.brand;

  return (
    <div
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border/70 bg-card p-5 shadow-card transition-all duration-fast hover:-translate-y-0.5 hover:border-border hover:shadow-card-hover",
        className,
      )}
    >
      {/* Layered surfaces: tone glow + gradient hairline */}
      <span
        className={cn(
          "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-fast group-hover:opacity-100",
          style.glow,
        )}
        aria-hidden="true"
      />
      <span
        className={cn(
          "pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent to-transparent",
          style.hairline,
        )}
        aria-hidden="true"
      />
      <div
        className={cn(
          "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-lg shadow-md transition-transform duration-fast group-hover:scale-105",
          style.chip,
        )}
      >
        <Icon className="h-5 w-5" aria-hidden="true" />
      </div>
      <div className="relative min-w-0">
        <p className="text-2xl font-semibold leading-tight tracking-tight text-foreground tabular-nums">
          {value}
        </p>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}