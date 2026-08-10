import * as React from "react";

import { cn } from "@/lib/utils";

// spec §3.2: h-9 w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-xs
const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          // base
          "flex h-9 w-full rounded-md border border-input bg-white px-3 py-1 text-sm shadow-xs transition-colors",
          // placeholder
          "placeholder:text-slate-400",
          // focus: ring-2 ring-blue-600 ring-offset-1 border-blue-600 outline-none
          "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:border-primary focus-visible:outline-none",
          // disabled (spec §3.2: bg-slate-50 text-slate-400 cursor-not-allowed)
          "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400",
          // file
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
