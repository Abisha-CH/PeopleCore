import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/*
 * Shared banner shown when the frontend has no Firebase configuration
 * (missing .env). Used by both the login page and the protected route so the
 * copy and styling never drift apart.
 */
export function FirebaseConfigError() {
  return (
    <Alert variant="destructive">
      <AlertTitle>Firebase is not configured</AlertTitle>
      <AlertDescription>
        Add your Firebase project details to a{" "}
        <code className="rounded bg-destructive-100 px-1 font-mono text-xs">
          .env
        </code>{" "}
        file in the frontend, then restart the app.
      </AlertDescription>
    </Alert>
  );
}