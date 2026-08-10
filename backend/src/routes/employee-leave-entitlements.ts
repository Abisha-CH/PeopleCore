import { Router } from "express";
import type { RequestHandler } from "express";
import { db } from "../config/firebase";
import { AppError } from "../errors";
import { validateOverrideInput } from "../lib/validate-leave-config";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { assertCappedLeaveType } from "../services/leave-config";
import { fetchEmployee } from "../services/employees";
import { writeRoute } from "./write";

// ---- helpers ----------------------------------------------------------------

function compoundId(employeeId: string, leaveTypeId: string): string {
  return `${employeeId}_${leaveTypeId}`;
}

function serialise(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}) {
  const data = doc.data();
  return {
    employeeId: data?.employeeId as string,
    leaveTypeId: data?.leaveTypeId as string,
    daysPerYear: data?.daysPerYear as number,
  };
}

// ---- handlers ---------------------------------------------------------------

const createOverride: RequestHandler = async (req, res, next) => {
  try {
    const input = validateOverrideInput(req.body ?? {});

    // Referential integrity: employee must exist; leave type must exist and
    // must be capped.
    await fetchEmployee(input.employeeId);
    await assertCappedLeaveType(input.leaveTypeId);

    const id = compoundId(input.employeeId, input.leaveTypeId);
    const existing = await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .get();

    if (existing.exists) {
      throw new AppError(
        409,
        "DUPLICATE_OVERRIDE",
        "An entitlement override already exists for this employee and leave type.",
      );
    }

    await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .set({
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        daysPerYear: input.daysPerYear,
      });

    setAudit(res, {
      action: "employee_leave_entitlement.create",
      targetType: "EmployeeLeaveEntitlement",
      targetId: id,
    });
    setResult(res, 201, {
      override: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        daysPerYear: input.daysPerYear,
      },
    });
    next();
  } catch (err) {
    next(err);
  }
};

const listOverrides: RequestHandler = async (req, res) => {
  const { employeeId, leaveTypeId } = req.query;
  const snap = await db.collection("employeeLeaveEntitlements").get();

  let overrides = snap.docs
    .map((d) => serialise(d))
    .sort((a, b) =>
      a.employeeId.localeCompare(b.employeeId) ||
      a.leaveTypeId.localeCompare(b.leaveTypeId),
    );

  if (typeof employeeId === "string" && employeeId.length > 0) {
    overrides = overrides.filter((o) => o.employeeId === employeeId);
  }

  if (typeof leaveTypeId === "string" && leaveTypeId.length > 0) {
    overrides = overrides.filter((o) => o.leaveTypeId === leaveTypeId);
  }

  res.json({ overrides, total: overrides.length });
};

const getOverride: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Entitlement override not found.");
    }

    res.json({ override: serialise(doc) });
  } catch (err) {
    next(err);
  }
};

const updateOverride: RequestHandler = async (req, res, next) => {
  try {
    const input = validateOverrideInput(req.body ?? {});
    const id = compoundId(input.employeeId, input.leaveTypeId);

    const existingDoc = await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .get();
    if (!existingDoc.exists) {
      throw new AppError(
        404,
        "NOT_FOUND",
        "Entitlement override not found for this employee and leave type.",
      );
    }

    // The leave type must still be capped.
    await assertCappedLeaveType(input.leaveTypeId);

    const before = existingDoc.data()?.daysPerYear as number;

    await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .update({ daysPerYear: input.daysPerYear });

    setAudit(res, {
      action: "employee_leave_entitlement.update",
      targetType: "EmployeeLeaveEntitlement",
      targetId: id,
      diff: { daysPerYear: { before, after: input.daysPerYear } },
    });
    setResult(res, 200, {
      override: {
        employeeId: input.employeeId,
        leaveTypeId: input.leaveTypeId,
        daysPerYear: input.daysPerYear,
      },
    });
    next();
  } catch (err) {
    next(err);
  }
};

const deleteOverride: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db
      .collection("employeeLeaveEntitlements")
      .doc(id)
      .get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Entitlement override not found.");
    }

    const data = doc.data();
    await db.collection("employeeLeaveEntitlements").doc(id).delete();

    setAudit(res, {
      action: "employee_leave_entitlement.delete",
      targetType: "EmployeeLeaveEntitlement",
      targetId: id,
    });
    setResult(res, 200, {
      override: {
        employeeId: data?.employeeId as string,
        leaveTypeId: data?.leaveTypeId as string,
        daysPerYear: data?.daysPerYear as number,
      },
    });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const employeeLeaveEntitlementsRouter = Router();

employeeLeaveEntitlementsRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createOverride),
);
employeeLeaveEntitlementsRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  listOverrides,
);
employeeLeaveEntitlementsRouter.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  getOverride,
);
employeeLeaveEntitlementsRouter.put(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updateOverride),
);
employeeLeaveEntitlementsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deleteOverride),
);
