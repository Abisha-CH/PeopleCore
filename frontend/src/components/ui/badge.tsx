import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/*
 * Badge — compact status chip. Soft tinted backgrounds keep AA contrast
 * on the tinted surfaces (text uses the 700–800 end of each ramp).
 */
const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium leading-4",
  {
    variants: {
      variant: {
        success: "border-success-200 bg-success-50 text-success-700",
        warning: "border-warning-200 bg-warning-50 text-warning-700",
        destructive: "border-destructive-200 bg-destructive-50 text-destructive-700",
        info: "border-sky-200 bg-sky-50 text-sky-700",
        neutral: "border-slate-200 bg-slate-100 text-slate-600",
        default:
          "border-transparent bg-primary text-primary-foreground",
        outline: "border-border bg-transparent text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
