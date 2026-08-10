import { Suspense, lazy } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { MotionConfig } from "framer-motion";

import { queryClient } from "@/lib/query-client";
import { AuthProvider } from "@/providers/auth-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { ErrorBoundary } from "@/components/error-boundary";
import { PageLoader } from "@/components/feedback/page-loader";

const AppRoutes = lazy(() =>
  import("@/routes/app-routes").then((m) => ({ default: m.AppRoutes })),
);

/*
 * Resets the error boundary whenever the route changes, so a render error on
 * one page doesn't lock the whole app until a manual reload.
 */
function RouteAwareBoundary() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<PageLoader />}>
        <AppRoutes />
      </Suspense>
    </ErrorBoundary>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider delayDuration={300}>
            <MotionConfig reducedMotion="user">
              <RouteAwareBoundary />
              <Toaster />
            </MotionConfig>
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
