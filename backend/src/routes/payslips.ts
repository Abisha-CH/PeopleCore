import { Router } from "express";
import type { RequestHandler } from "express";
import { db, FieldValue } from "../config/firebase";
import { AppError } from "../errors";
import {
  validatePayslipCreate,
  validatePayslipUpdate,
} from "../lib/validate-payslip";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { toPayrollProfile } from "../services/payroll-profiles";
import {
  computeNetSalary,
  fetchAllPayslips,
  fetchPayslip,
  payslipDocId,
  toPayslip,
} from "../services/payslips";
import { isPayslipStatus } from "../types";
import { writeRoute } from "./write";

// ---- handlers ---------------------------------------------------------------

const generatePayslip: RequestHandler = async (req, res, next) => {
  try {
    const input = validatePayslipCreate(req.body ?? {});
    const payslipId = payslipDocId(input.employeeId, input.year, input.month);

    // Generation runs inside a transaction so a duplicate request for the same
    // employee/month/year cannot create a second payslip: the deterministic doc
    // ID is read (must not exist) and written within the same atomic step.
    await db.runTransaction(async (t) => {
      // 1. Read the PayrollProfile for the baseSalary snapshot.
      const profileSnap = await t.get(
        db.collection("payrollProfiles").doc(input.employeeId),
      );
      if (!profileSnap.exists) {
        throw new AppError(
          404,
          "NOT_FOUND",
          "No payroll profile exists for this employee.",
        );
      }
      const profile = toPayrollProfile(profileSnap);
      if (!profile) {
        throw new AppError(
          404,
          "NOT_FOUND",
          "No payroll profile exists for this employee.",
        );
      }

      // 2. Verify the deterministic payslip ID does not already exist.
      const payslipRef = db
        .collection("payrollProfiles")
        .doc(input.employeeId)
        .collection("payslips")
        .doc(payslipId);
      const existing = await t.get(payslipRef);
      if (existing.exists) {
        throw new AppError(
          409,
          "PAYSLIP_EXISTS",
          "A payslip already exists for this employee in the specified month and year.",
        );
      }

      // 3. Create the draft payslip with the salary snapshot. Deductions start
      // empty, so netSalary equals baseSalary; both are fixed at generation.
      t.set(payslipRef, {
        payslipId,
        employeeId: input.employeeId,
        month: input.month,
        year: input.year,
        baseSalary: profile.baseSalary,
        deductions: [],
        netSalary: profile.baseSalary,
        generatedAt: FieldValue.serverTimestamp(),
        status: "draft",
      });
    });

    const created = await db
      .collection("payrollProfiles")
      .doc(input.employeeId)
      .collection("payslips")
      .doc(payslipId)
      .get();
    const payslip = toPayslip(created);
    if (!payslip) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to read back the created payslip.",
      );
    }

    setAudit(res, {
      action: "payslip.create",
      targetType: "Payslip",
      targetId: payslipId,
    });
    setResult(res, 201, { payslip });
    next();
  } catch (err) {
    next(err);
  }
};

const listPayslips: RequestHandler = async (req, res, next) => {
  try {
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

    let payslips = await fetchAllPayslips();

    if (actor.role === "admin") {
      // HR Admin sees all payslips, with optional employeeId/status filters.
      const { employeeId, status } = req.query;
      if (typeof employeeId === "string" && employeeId.length > 0) {
        payslips = payslips.filter((p) => p.employeeId === employeeId);
      }
      if (typeof status === "string" && status.length > 0) {
        if (!isPayslipStatus(status)) {
          throw new AppError(
            400,
            "INVALID_STATUS",
            "status must be 'draft' or 'published'.",
          );
        }
        payslips = payslips.filter((p) => p.status === status);
      }
    } else {
      // Employee and Line Manager: own published payslips only.
      payslips = payslips.filter(
        (p) => p.employeeId === actor.uid && p.status === "published",
      );
    }

    // Newest first (year desc, then month desc), matching UC-10.
    payslips.sort((a, b) => {
      if (b.year !== a.year) return b.year - a.year;
      return b.month - a.month;
    });

    res.json({ payslips, total: payslips.length });
  } catch (err) {
    next(err);
  }
};

const getPayslip: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const payslip = await fetchPayslip(id);

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

    // HR Admin reads any payslip; Employee/Line Manager read their own
    // published payslips only (drafts are never visible to them).
    if (actor.role !== "admin") {
      if (payslip.employeeId !== actor.uid) {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "You do not have permission to view this payslip.",
          },
        });
        return;
      }
      if (payslip.status !== "published") {
        res.status(403).json({
          error: {
            code: "FORBIDDEN",
            message: "Draft payslips are not visible to employees.",
          },
        });
        return;
      }
    }

    res.json({ payslip });
  } catch (err) {
    next(err);
  }
};

const updatePayslip: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const input = validatePayslipUpdate(req.body ?? {});
    const payslip = await fetchPayslip(id);

    if (payslip.status !== "draft") {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only draft payslips can be edited.",
      );
    }

    // netSalary is recomputed from the stored baseSalary snapshot.
    const nextNetSalary = computeNetSalary(payslip.baseSalary, input.deductions);
    if (nextNetSalary < 0) {
      throw new AppError(
        400,
        "DEDUCTIONS_EXCEED_SALARY",
        "Total deductions cannot exceed the base salary.",
      );
    }

    await db
      .collection("payrollProfiles")
      .doc(payslip.employeeId)
      .collection("payslips")
      .doc(id)
      .update({
        deductions: input.deductions,
        netSalary: nextNetSalary,
      });

    const updated = await db
      .collection("payrollProfiles")
      .doc(payslip.employeeId)
      .collection("payslips")
      .doc(id)
      .get();
    const updatedPayslip = toPayslip(updated);
    if (!updatedPayslip) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to read back the updated payslip.",
      );
    }

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    if (
      JSON.stringify(payslip.deductions) !== JSON.stringify(input.deductions)
    ) {
      diff.deductions = { before: payslip.deductions, after: input.deductions };
    }
    if (payslip.netSalary !== nextNetSalary) {
      diff.netSalary = { before: payslip.netSalary, after: nextNetSalary };
    }

    setAudit(res, {
      action: "payslip.update",
      targetType: "Payslip",
      targetId: id,
      diff,
    });
    setResult(res, 200, { payslip: updatedPayslip });
    next();
  } catch (err) {
    next(err);
  }
};

const publishPayslip: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const payslip = await fetchPayslip(id);

    if (payslip.status !== "draft") {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only draft payslips can be published.",
      );
    }

    await db
      .collection("payrollProfiles")
      .doc(payslip.employeeId)
      .collection("payslips")
      .doc(id)
      .update({
        status: "published",
      });

    const updated = await db
      .collection("payrollProfiles")
      .doc(payslip.employeeId)
      .collection("payslips")
      .doc(id)
      .get();
    const published = toPayslip(updated);
    if (!published) {
      throw new AppError(
        500,
        "INTERNAL_ERROR",
        "Failed to read back the published payslip.",
      );
    }

    setAudit(res, {
      action: "payslip.publish",
      targetType: "Payslip",
      targetId: id,
      diff: { status: { before: "draft", after: "published" } },
    });
    setResult(res, 200, { payslip: published });
    next();
  } catch (err) {
    next(err);
  }
};

const deletePayslip: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const payslip = await fetchPayslip(id);

    if (payslip.status !== "draft") {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "Only draft payslips can be deleted.",
      );
    }

    await db
      .collection("payrollProfiles")
      .doc(payslip.employeeId)
      .collection("payslips")
      .doc(id)
      .delete();

    setAudit(res, {
      action: "payslip.delete",
      targetType: "Payslip",
      targetId: id,
    });
    setResult(res, 200, { payslip });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const payslipsRouter = Router();

payslipsRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(generatePayslip),
);
payslipsRouter.get("/", requireAuth, listPayslips);
payslipsRouter.get("/:id", requireAuth, getPayslip);
payslipsRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updatePayslip),
);
payslipsRouter.patch(
  "/:id/publish",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(publishPayslip),
);
payslipsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deletePayslip),
);
