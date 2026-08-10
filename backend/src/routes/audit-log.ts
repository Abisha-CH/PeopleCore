import { Router } from "express";
import type { RequestHandler } from "express";
import { db } from "../config/firebase";
import { requireAuth, requireRole } from "../middleware/auth";
import type { AuditLogEntry } from "../types";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

function toIso(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (typeof obj.toDate === "function") {
      return (obj.toDate as () => Date)().toISOString();
    }
  }
  if (typeof value === "string") {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function toEntry(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): AuditLogEntry | null {
  const data = doc.data();
  if (!data) return null;

  return {
    auditLogId: doc.id,
    actorId: data.actorId as string,
    actorRole: data.actorRole as AuditLogEntry["actorRole"],
    action: data.action as string,
    targetType: data.targetType as string,
    targetId: data.targetId as string,
    timestamp: toIso(data.timestamp),
    diff: data.diff as AuditLogEntry["diff"],
  };
}

const listAuditLog: RequestHandler = async (req, res) => {
  const { targetType, actorId, from, to, limit: limitRaw } = req.query;

  const limit = Math.min(
    Math.max(Number(limitRaw ?? DEFAULT_LIMIT) || DEFAULT_LIMIT, 1),
    MAX_LIMIT,
  );

  // Fetch all entries and filter/sort in memory to avoid composite-index
  // requirements on Firestore. Acceptable at ≤200 employees (workshop scale).
  const snap = await db.collection("auditLog").get();

  let entries = snap.docs
    .map((d) => toEntry(d))
    .filter((e): e is AuditLogEntry => e !== null);

  if (typeof targetType === "string" && targetType.length > 0) {
    entries = entries.filter((e) => e.targetType === targetType);
  }

  if (typeof actorId === "string" && actorId.length > 0) {
    entries = entries.filter((e) => e.actorId === actorId);
  }

  if (typeof from === "string") {
    const fromDate = new Date(from);
    if (!Number.isNaN(fromDate.getTime())) {
      entries = entries.filter(
        (e) => e.timestamp !== null && new Date(e.timestamp) >= fromDate,
      );
    }
  }

  if (typeof to === "string") {
    const toDate = new Date(to);
    if (!Number.isNaN(toDate.getTime())) {
      entries = entries.filter(
        (e) => e.timestamp !== null && new Date(e.timestamp) <= toDate,
      );
    }
  }

  entries.sort((a, b) => {
    const at = a.timestamp ?? "";
    const bt = b.timestamp ?? "";
    return bt.localeCompare(at);
  });

  entries = entries.slice(0, limit);

  res.json({ entries, total: entries.length });
};

const getAuditLogEntry: RequestHandler = async (req, res) => {
  const raw = req.params.id;
  const id = Array.isArray(raw) ? raw[0] : raw;
  if (!id) {
    res.status(400).json({
      error: { code: "INVALID_ID", message: "Audit log entry ID is required." },
    });
    return;
  }

  const doc = await db.collection("auditLog").doc(id).get();
  if (!doc.exists) {
    res.status(404).json({
      error: {
        code: "NOT_FOUND",
        message: "Audit log entry not found.",
      },
    });
    return;
  }

  res.json({ entry: toEntry(doc) });
};

export const auditLogRouter = Router();

auditLogRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  listAuditLog,
);

auditLogRouter.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  getAuditLogEntry,
);
