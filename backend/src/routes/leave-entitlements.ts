import { Router } from "express";
import type { RequestHandler } from "express";
import { db } from "../config/firebase";
import { AppError } from "../errors";
import { validateEntitlementInput } from "../lib/validate-leave-config";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { assertCappedLeaveType, fetchLeaveType } from "../services/leave-config";
import { writeRoute } from "./write";

// ---- handlers ---------------------------------------------------------------

const getEntitlement: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.leaveTypeId;
    const id = Array.isArray(raw) ? raw[0] : raw;

    // 404 if the leave type itself does not exist.
    await fetchLeaveType(id);

    const doc = await db.collection("leaveEntitlements").doc(id).get();
    if (!doc.exists) {
      throw new AppError(
        404,
        "NOT_FOUND",
        "Leave entitlement not found for this leave type.",
      );
    }

    const data = doc.data();
    res.json({
      entitlement: { leaveTypeId: doc.id, daysPerYear: data?.daysPerYear as number },
    });
  } catch (err) {
    next(err);
  }
};

const upsertEntitlement: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.leaveTypeId;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const { daysPerYear } = validateEntitlementInput(req.body ?? {});

    // 404 if leave type missing; 400 if the leave type is not capped.
    await assertCappedLeaveType(id);

    const existingDoc = await db.collection("leaveEntitlements").doc(id).get();
    const isCreate = !existingDoc.exists;
    const before = isCreate ? undefined : (existingDoc.data()?.daysPerYear as number);

    await db
      .collection("leaveEntitlements")
      .doc(id)
      .set({ leaveTypeId: id, daysPerYear });

    const audit: {
      action: string;
      targetType: string;
      targetId: string;
      diff?: Record<string, { before: unknown; after: unknown }>;
    } = {
      action: isCreate ? "leave_entitlement.create" : "leave_entitlement.update",
      targetType: "LeaveEntitlement",
      targetId: id,
    };

    if (!isCreate) {
      audit.diff = { daysPerYear: { before, after: daysPerYear } };
    }

    setAudit(res, audit);
    setResult(res, isCreate ? 201 : 200, {
      entitlement: { leaveTypeId: id, daysPerYear },
    });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const leaveEntitlementsRouter = Router();

leaveEntitlementsRouter.get(
  "/:leaveTypeId",
  requireAuth,
  requireRole("admin"),
  getEntitlement,
);
leaveEntitlementsRouter.put(
  "/:leaveTypeId",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(upsertEntitlement),
);
