const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "/api";

/** Network requests that outlive this budget are aborted. */
export const REQUEST_TIMEOUT_MS = 15_000;

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** True when the failure is retryable (network / server / timeout). */
  get retryable(): boolean {
    return this.status >= 500 || this.status === 408 || this.status === 0;
  }
}

let tokenProvider: () => Promise<string | null> = async () => null;
let unauthorizedHandler: (() => void) | null = null;

export function setTokenProvider(fn: () => Promise<string | null>): void {
  tokenProvider = fn;
}

/** Registered by the auth layer: fires when the API returns 401 (session expired). */
export function setUnauthorizedHandler(fn: (() => void) | null): void {
  unauthorizedHandler = fn;
}

interface ApiRequestOptions extends RequestInit {
  /** Do not attach the Authorization header (for public endpoints). */
  public?: boolean;
  timeoutMs?: number;
}

export async function apiRequest<T>(
  path: string,
  init: ApiRequestOptions = {},
): Promise<T> {
  const token = init.public ? null : await tokenProvider();
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.headers ?? {}),
      },
    });

    if (res.status === 401) {
      // Session expired or invalid token — let the auth layer respond.
      unauthorizedHandler?.();
    }

    if (!res.ok) {
      let body: { error?: { code?: string; message?: string } } | null = null;
      try {
        body = await res.json();
      } catch {
        /* non-JSON error body */
      }
      throw new ApiError(
        res.status,
        body?.error?.code ?? "REQUEST_FAILED",
        body?.error?.message ?? `Request failed with status ${res.status}.`,
      );
    }

    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new ApiError(
        408,
        "REQUEST_TIMEOUT",
        "The request timed out. Please try again.",
      );
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      "Unable to reach the server. Check your connection and try again.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function jsonBody(body?: unknown): RequestInit {
  return body === undefined
    ? {}
    : { body: JSON.stringify(body) };
}

export const api = {
  get: <T>(path: string, opts?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "POST", ...jsonBody(body) }),
  put: <T>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "PUT", ...jsonBody(body) }),
  patch: <T>(path: string, body?: unknown, opts?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "PATCH", ...jsonBody(body) }),
  del: <T>(path: string, opts?: ApiRequestOptions) =>
    apiRequest<T>(path, { ...opts, method: "DELETE" }),
};

/**
 * Build a query string from a record, dropping empty/undefined values so
 * optional filters don't reach the server as empty strings. Generic over the
 * input so typed filter interfaces are accepted directly.
 */
export function buildQuery<T extends object>(params: T): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

/** Map an error to a user-facing message for toasts/inline alerts. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong. Please try again.";
}
