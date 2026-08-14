import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/*
 * EmptyState — centered call-to-action placeholder for empty data regions.
 * The icon sits in a soft brand-tinted ring for a calmer, more premium look
 * than a bare grey glyph.
 */

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  /** Tint of the icon ring. */
  tone?: "brand" | "muted";
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
  tone = "brand",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center px-8 py-16 text-center",
        className,
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full shadow-sm transition-transform duration-fast",
          tone === "brand"
            ? "bg-brand-gradient text-white shadow-brand-600/30"
            : "bg-muted text-muted-foreground",
        )}
      >
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-foreground">{title}</h3>
      {description && (
        <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
