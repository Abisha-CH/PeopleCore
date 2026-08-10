import { Router } from "express";
import type { RequestHandler } from "express";
import { db, FieldValue } from "../config/firebase";
import { AppError } from "../errors";
import { validateLeaveTypeInput } from "../lib/validate-leave-config";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { fetchLeaveType } from "../services/leave-config";
import type { LeaveType } from "../types";
import { writeRoute } from "./write";

// ---- serialisation ----------------------------------------------------------

function toLeaveType(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): LeaveType | null {
  const data = doc.data();
  if (!data) return null;

  return {
    leaveTypeId: doc.id,
    name: data.name as string,
    isCapped: data.isCapped as boolean,
    defaultDaysPerYear: data.defaultDaysPerYear as number,
  };
}

// ---- helpers ----------------------------------------------------------------

async function findDuplicateName(
  name: string,
  excludeId?: string,
): Promise<boolean> {
  const snap = await db.collection("leaveTypes").get();
  const target = name.trim().toLowerCase();
  return snap.docs.some((d) => {
    if (d.id === excludeId) return false;
    const data = d.data();
    return (
      typeof data?.name === "string" &&
      data.name.trim().toLowerCase() === target
    );
  });
}

function computeDiff(
  before: LeaveType,
  after: LeaveType,
): Record<string, { before: unknown; after: unknown }> {
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of ["name", "isCapped", "defaultDaysPerYear"]) {
    const b = before[key as keyof LeaveType];
    const a = after[key as keyof LeaveType];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}

/**
 * When a leave type is deleted or becomes uncapped, remove the company-wide
 * entitlement (if any) and all per-employee overrides (if any) so no orphaned
 * configuration remains.
 */
async function cascadeRemoveTypeConfig(
  leaveTypeId: string,
  actor: { uid: string; role: string },
): Promise<void> {
  // Collect every document removal (and its audit entry) into a single
  // WriteBatch so the cascade is atomic: either the entitlement, all overrides
  // and their audit records are removed together, or none of them are.
  const batch = db.batch();

  // Delete the company-wide entitlement document (doc id = leaveTypeId).
  const entDoc = await db.collection("leaveEntitlements").doc(leaveTypeId).get();
  if (entDoc.exists) {
    batch.delete(db.collection("leaveEntitlements").doc(leaveTypeId));
    batch.set(db.collection("auditLog").doc(), {
      actorId: actor.uid,
      actorRole: actor.role,
      action: "leave_entitlement.delete",
      targetType: "LeaveEntitlement",
      targetId: leaveTypeId,
      timestamp: FieldValue.serverTimestamp(),
    });
  }

  // Delete any per-employee overrides that reference this leave type.
  const overrideSnap = await db
    .collection("employeeLeaveEntitlements")
    .where("leaveTypeId", "==", leaveTypeId)
    .get();

  for (const doc of overrideSnap.docs) {
    batch.delete(db.collection("employeeLeaveEntitlements").doc(doc.id));
    batch.set(db.collection("auditLog").doc(), {
      actorId: actor.uid,
      actorRole: actor.role,
      action: "employee_leave_entitlement.delete",
      targetType: "EmployeeLeaveEntitlement",
      targetId: doc.id,
      timestamp: FieldValue.serverTimestamp(),
    });
  }

  await batch.commit();
}

// ---- handlers ---------------------------------------------------------------

const createLeaveType: RequestHandler = async (req, res, next) => {
  try {
    const input = validateLeaveTypeInput(req.body ?? {});

    if (await findDuplicateName(input.name)) {
      throw new AppError(
        409,
        "DUPLICATE_NAME",
        "A leave type with this name already exists.",
      );
    }

    const ref = db.collection("leaveTypes").doc();
    await ref.set({
      name: input.name,
      isCapped: input.isCapped,
      defaultDaysPerYear: input.defaultDaysPerYear,
    });

    const leaveType: LeaveType = { leaveTypeId: ref.id, ...input };

    setAudit(res, {
      action: "leave_type.create",
      targetType: "LeaveType",
      targetId: ref.id,
    });
    setResult(res, 201, { leaveType });
    next();
  } catch (err) {
    next(err);
  }
};

const listLeaveTypes: RequestHandler = async (_req, res) => {
  const snap = await db.collection("leaveTypes").get();
  const leaveTypes = snap.docs
    .map((d) => toLeaveType(d))
    .filter((t): t is LeaveType => t !== null)
    .sort((a, b) => a.name.localeCompare(b.name));

  res.json({ leaveTypes, total: leaveTypes.length });
};

const getLeaveType: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const leaveType = await fetchLeaveType(id);
    res.json({ leaveType });
  } catch (err) {
    next(err);
  }
};

const updateLeaveType: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const input = validateLeaveTypeInput(req.body ?? {});
    const existing = await fetchLeaveType(id);

    if (await findDuplicateName(input.name, id)) {
      throw new AppError(
        409,
        "DUPLICATE_NAME",
        "A leave type with this name already exists.",
      );
    }

    const nextRecord: LeaveType = { leaveTypeId: id, ...input };
    const diff = computeDiff(existing, nextRecord);

    await db.collection("leaveTypes").doc(id).set(nextRecord);

    // If a capped type becomes uncapped, remove entitlement config.
    if (existing.isCapped && !input.isCapped) {
      const actor = req.auth!;
      await cascadeRemoveTypeConfig(id, actor);
    }

    setAudit(res, {
      action: "leave_type.update",
      targetType: "LeaveType",
      targetId: id,
      diff,
    });
    setResult(res, 200, { leaveType: nextRecord });
    next();
  } catch (err) {
    next(err);
  }
};

const deleteLeaveType: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const existing = await fetchLeaveType(id);

    // Preserve historical LeaveRequest documents (they keep their leaveTypeId).
    // Remove the type's configuration (entitlement + overrides) to avoid
    // orphaned references.
    const actor = req.auth!;
    await cascadeRemoveTypeConfig(id, actor);
    await db.collection("leaveTypes").doc(id).delete();

    setAudit(res, {
      action: "leave_type.delete",
      targetType: "LeaveType",
      targetId: id,
    });
    setResult(res, 200, { leaveType: existing });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const leaveTypesRouter = Router();

leaveTypesRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createLeaveType),
);
// Reads are available to every authenticated user — employees and managers
// need the leave-type list for leave-request forms and balance displays.
// Create/update/delete remain admin-only below.
leaveTypesRouter.get("/", requireAuth, listLeaveTypes);
leaveTypesRouter.get("/:id", requireAuth, getLeaveType);
leaveTypesRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updateLeaveType),
);
leaveTypesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deleteLeaveType),
);
