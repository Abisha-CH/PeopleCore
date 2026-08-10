import * as React from "react";

import { AlertTriangle, RotateCw } from "lucide-react";

import { Button } from "@/components/ui/button";

/*
 * ErrorBoundary — catches render-time errors below it and shows a calm,
 * actionable recovery screen instead of a white page. Rendered errors are
 * still logged so they surface in devtools / crash reporting.
 *
 * Pass a `resetKey` (e.g. the current route) to automatically reset the
 * boundary when the key changes — this makes navigation recover on its own
 * without a manual reload.
 */

interface ErrorBoundaryProps {
  children: React.ReactNode;
  /** When this value changes, a captured error is cleared (e.g. route path). */
  resetKey?: string | null;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    // Keep the console trace visible for debugging / error reporting.
    console.error("[ErrorBoundary] Caught render error:", error, info);
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.reset();
    }
  }

  reset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const error = this.state.error;

    return (
      <div
        role="alert"
        className="flex min-h-[60vh] w-full items-center justify-center p-8"
      >
        <div className="w-full max-w-md rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle
              className="h-6 w-6 text-destructive"
              aria-hidden="true"
            />
          </div>
          <h2 className="mt-4 text-base font-semibold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            An unexpected error occurred while rendering this page. Your data is
            safe — try reloading the page.
          </p>

          {error?.message && (
            <details className="mt-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-left">
              <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
                Error details
              </summary>
              <pre className="mt-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-muted-foreground">
                {error.message}
              </pre>
            </details>
          )}

          <div className="mt-6 flex items-center justify-center gap-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              <RotateCw className="mr-2 h-4 w-4" aria-hidden="true" />
              Reload page
            </Button>
            <Button onClick={this.reset}>Try again</Button>
          </div>
        </div>
      </div>
    );
  }
}
