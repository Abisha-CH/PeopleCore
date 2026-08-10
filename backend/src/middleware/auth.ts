import type { NextFunction, Request, RequestHandler, Response } from "express";
import { verifyIdToken } from "../config/firebase";
import type { Role } from "../types";

export const requireAuth: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const header = _req.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;

  if (!token) {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Authentication required. Provide a valid bearer token.",
      },
    });
    return;
  }

  try {
    const decoded = await verifyIdToken(token);
    const role: Role =
      decoded.role === "admin" ||
      decoded.role === "manager" ||
      decoded.role === "employee"
        ? decoded.role
        : "employee";

    _req.auth = { uid: decoded.uid, email: decoded.email, role };
    next();
  } catch {
    res.status(401).json({
      error: {
        code: "UNAUTHENTICATED",
        message: "Invalid or expired authentication token.",
      },
    });
  }
};

export function requireRole(...allowed: Role[]): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
        },
      });
      return;
    }

    if (!allowed.includes(req.auth.role)) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to perform this action.",
        },
      });
      return;
    }

    next();
  };
}
