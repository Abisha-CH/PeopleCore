import type { RequestHandler } from "express";
import { auditMiddleware } from "../middleware/audit";
import { sendResult } from "../middleware/respond";

/**
 * Composes a write-route pipeline:
 *  1. handler  – sets res.locals.result + res.locals.audit, then calls next()
 *  2. auditMiddleware – persists the audit entry (awaited)
 *  3. sendResult – writes the JSON response
 *
 * Using this ensures the audit write completes before the response is sent,
 * which makes tests deterministic (no race between response and audit).
 */
export function writeRoute(handler: RequestHandler): RequestHandler[] {
  return [handler, auditMiddleware, sendResult];
}
