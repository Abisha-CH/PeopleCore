import { Router } from "express";
import type { RequestHandler } from "express";
import { db, FieldValue } from "../config/firebase";
import { AppError } from "../errors";
import {
  validatePayrollProfileCreate,
  validatePayrollProfileInput,
} from "../lib/validate-payroll-profile";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { fetchEmployee } from "../services/employees";
import {
  computeDiff,
  fetchPayrollProfile,
  toPayrollProfile,
} from "../services/payroll-profiles";
import type { PayrollProfile } from "../types";
import { writeRoute } from "./write";

// ---- handlers ---------------------------------------------------------------

const createPayrollProfile: RequestHandler = async (req, res, next) => {
  try {
    const input = validatePayrollProfileCreate(req.body ?? {});

    // The employee must exist and a profile may be created only once (the doc
    // ID equals employeeId, so the exists-check is a single read).
    await fetchEmployee(input.employeeId);
    const existing = await db
      .collection("payrollProfiles")
      .doc(input.employeeId)
      .get();
    if (existing.exists) {
      throw new AppError(
        409,
        "PAYROLL_PROFILE_EXISTS",
        "A payroll profile already exists for this employee.",
      );
    }

    const ref = db.collection("payrollProfiles").doc(input.employeeId);
    await ref.set({
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
      baseSalary: input.baseSalary,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    const created = await ref.get();
    const profile = toPayrollProfile(created);
    if (!profile) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to read back the created payroll profile.",
      );
    }

    setAudit(res, {
      action: "payroll_profile.create",
      targetType: "PayrollProfile",
      targetId: profile.employeeId,
    });
    setResult(res, 201, { profile });
    next();
  } catch (err) {
    next(err);
  }
};

const getPayrollProfile: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.employeeId;
    const employeeId = Array.isArray(raw) ? raw[0] : raw;
    const profile = await fetchPayrollProfile(employeeId);

    const actor = req.auth;
    if (!actor) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
        },
      });
      return;
    }

    // HR Admin reads any profile; the owning Employee reads their own only.
    // Line Managers have no access at all — 403 even for their own profile.
    const allowed =
      actor.role === "admin" ||
      (actor.role === "employee" && actor.uid === employeeId);
    if (!allowed) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to view this payroll profile.",
        },
      });
      return;
    }

    res.json({ profile });
  } catch (err) {
    next(err);
  }
};

const updatePayrollProfile: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.employeeId;
    const employeeId = Array.isArray(raw) ? raw[0] : raw;
    const input = validatePayrollProfileInput(req.body ?? {});
    const existing = await fetchPayrollProfile(employeeId);

    const nextRecord: PayrollProfile = {
      ...existing,
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
      baseSalary: input.baseSalary,
    };
    const diff = computeDiff(existing, nextRecord);

    // Only the business fields and updatedAt are written. createdAt is never
    // overwritten, and payslip snapshots (Ticket 11) keep their own baseSalary,
    // so editing the profile never rewrites historical pay data.
    await db.collection("payrollProfiles").doc(employeeId).update({
      bankAccountNumber: input.bankAccountNumber,
      bankName: input.bankName,
      baseSalary: input.baseSalary,
      updatedAt: FieldValue.serverTimestamp(),
    });

    const updated = await db
      .collection("payrollProfiles")
      .doc(employeeId)
      .get();
    const profile = toPayrollProfile(updated);
    if (!profile) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to read back the updated payroll profile.",
      );
    }

    setAudit(res, {
      action: "payroll_profile.update",
      targetType: "PayrollProfile",
      targetId: employeeId,
      diff,
    });
    setResult(res, 200, { profile });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const payrollProfilesRouter = Router();

payrollProfilesRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createPayrollProfile),
);
payrollProfilesRouter.get("/:employeeId", requireAuth, getPayrollProfile);
payrollProfilesRouter.put(
  "/:employeeId",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updatePayrollProfile),
);
