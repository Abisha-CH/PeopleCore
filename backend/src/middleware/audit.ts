import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, FieldValue } from "../config/firebase";
import type { AuditDraft } from "../types";

export function setAudit(res: Response, entry: AuditDraft): void {
  res.locals.audit = entry;
}

export async function writeAuditLog(
  entry: AuditDraft & { actorId: string; actorRole: string },
): Promise<string> {
  const ref = db.collection("auditLog").doc();
  const payload: Record<string, unknown> = {
    actorId: entry.actorId,
    actorRole: entry.actorRole,
    action: entry.action,
    targetType: entry.targetType,
    targetId: entry.targetId,
    timestamp: FieldValue.serverTimestamp(),
  };

  if (entry.diff && Object.keys(entry.diff).length > 0) {
    payload.diff = entry.diff;
  }

  await ref.set(payload);
  return ref.id;
}

export const auditMiddleware: RequestHandler = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  const audit = res.locals.audit;

  if (res.statusCode < 400 && audit && _req.auth) {
    try {
      await writeAuditLog({
        ...audit,
        actorId: _req.auth.uid,
        actorRole: _req.auth.role,
      });
    } catch (err) {
      console.error("[peoplecore] Failed to write audit log entry:", err);
    }
  }

  next();
};
