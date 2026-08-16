import { Link } from "react-router-dom";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

/*
 * NotFoundPage — branded 404 inside the app shell.
 * A soft atmospheric treatment (glow orbs + oversized watermark) keeps the
 * moment calm and premium rather than an error box.
 */

export function NotFoundPage() {
  return (
    <div className="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4">
      {/* Atmosphere */}
      <div
        className="pointer-events-none absolute -top-24 right-[15%] h-72 w-72 rounded-full bg-indigo-500/10 blur-3xl"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-20 left-[10%] h-72 w-72 rounded-full bg-teal-400/10 blur-3xl"
        aria-hidden="true"
      />

      <div className="relative text-center">
        {/* Oversized watermark */}
        <p
          className="select-none text-[120px] font-bold leading-none tracking-tighter text-slate-100 sm:text-[160px]"
          aria-hidden="true"
        >
          404
        </p>

        <div className="-mt-8 flex flex-col items-center sm:-mt-12">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-lg shadow-brand-600/30">
            <Compass className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Page not found
          </h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
            The page you&apos;re looking for doesn&apos;t exist or has been
            moved. If you expected it to be here, contact your administrator.
          </p>
          <Button asChild className="mt-7">
            <Link to="/dashboard">Back to Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
