import type { NextFunction, Request, Response } from "express";
import { AppError } from "../errors";

export function notFound(_req: Request, res: Response) {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${_req.method} ${_req.path} not found.`,
    },
  });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (err instanceof AppError) {
    res
      .status(err.statusCode)
      .json({ error: { code: err.code, message: err.message } });
    return;
  }

  const e = err as { code?: string; status?: number; type?: string };

  if (e?.type === "entity.parse.failed" || e?.status === 400) {
    res.status(400).json({
      error: {
        code: "INVALID_JSON",
        message: "Request body contains malformed JSON.",
      },
    });
    return;
  }

  if (typeof e?.code === "string" && e.code.startsWith("auth/")) {
    handleFirebaseAuthError(e.code, res);
    return;
  }

  if (e?.code === "not-found") {
    res.status(404).json({
      error: { code: "NOT_FOUND", message: "Resource not found." },
    });
    return;
  }

  console.error("[peoplecore] Unhandled error:", err);
  res.status(500).json({
    error: { code: "INTERNAL", message: "An unexpected error occurred." },
  });
}

function handleFirebaseAuthError(code: string, res: Response) {
  switch (code) {
    case "auth/email-already-exists":
      res.status(409).json({
        error: {
          code: "EMAIL_IN_USE",
          message: "An account with this email already exists.",
        },
      });
      return;
    case "auth/weak-password":
      res.status(400).json({
        error: {
          code: "WEAK_PASSWORD",
          message: "Password must be at least 6 characters.",
        },
      });
      return;
    case "auth/invalid-email":
      res.status(400).json({
        error: {
          code: "INVALID_EMAIL",
          message: "Enter a valid email address.",
        },
      });
      return;
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      res.status(401).json({
        error: {
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password.",
        },
      });
      return;
    default:
      res.status(400).json({
        error: { code: "BAD_REQUEST", message: "Invalid request." },
      });
  }
}
