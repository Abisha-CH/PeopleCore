import type { AuthContext, AuditDraft } from "./index";

declare global {
  namespace Express {
    interface Locals {
      audit?: AuditDraft;
      result?: { statusCode?: number; body?: unknown };
    }
    interface Request {
      auth?: AuthContext;
    }
  }
}

export {};
