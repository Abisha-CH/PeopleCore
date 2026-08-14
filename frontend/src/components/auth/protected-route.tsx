import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { useAuth } from "@/providers/auth-provider";
import { AppShell } from "@/components/layout/app-shell";
import { FirebaseConfigError } from "@/components/auth/firebase-config-error";

export function ProtectedRoute() {
  const { user, initializing, configError } = useAuth();
  const location = useLocation();

  if (configError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <FirebaseConfigError />
        </div>
      </div>
    );
  }

  if (initializing) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-background"
        role="status"
        aria-label="Loading"
      >
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <AppShell />;
}
