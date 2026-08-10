import { Router } from "express";
import type { RequestHandler } from "express";
import { db } from "../config/firebase";
import { writeAuditLog } from "../middleware/audit";
import { requireAuth, requireRole } from "../middleware/auth";
import { SEED_ENTITLEMENTS, SEED_LEAVE_TYPES } from "../types";

/**
 * POST /api/seed
 *
 * Idempotent seed routine that populates the three default Leave Types
 * (Annual, Medical, Unpaid) and their company-wide Leave Entitlements
 * for the two capped types.
 *
 * Uses a Firestore WriteBatch so either all documents are created or none.
 * Audit entries are written individually after the batch succeeds so that
 * a failure logging one entry does not block the others.
 *
 * Restricted to HR Admin.
 */
const seedData: RequestHandler = async (req, res, next) => {
  try {
    const actor = req.auth!;

    // ---- 1. Read existing documents ----------------------------------------
    const [ltSnap, entSnap] = await Promise.all([
      db.collection("leaveTypes").get(),
      db.collection("leaveEntitlements").get(),
    ]);

    const existingLtIds = new Set(ltSnap.docs.map((d) => d.id));
    const existingEntIds = new Set(entSnap.docs.map((d) => d.id));

    // ---- 2. Determine what needs to be created -----------------------------
    const ltToCreate = SEED_LEAVE_TYPES.filter((lt) => !existingLtIds.has(lt.id));
    const entToCreate = SEED_ENTITLEMENTS.filter(
      (e) => !existingEntIds.has(e.leaveTypeId),
    );

    if (ltToCreate.length === 0 && entToCreate.length === 0) {
      res.status(200).json({
        message: "Seed data already exists.",
        created: { leaveTypes: 0, leaveEntitlements: 0 },
      });
      return;
    }

    // ---- 3. Batch-write the missing documents ------------------------------
    const batch = db.batch();

    for (const lt of ltToCreate) {
      const ref = db.collection("leaveTypes").doc(lt.id);
      batch.set(ref, {
        name: lt.name,
        isCapped: lt.isCapped,
        defaultDaysPerYear: lt.defaultDaysPerYear,
      });
    }

    for (const ent of entToCreate) {
      const ref = db.collection("leaveEntitlements").doc(ent.leaveTypeId);
      batch.set(ref, {
        leaveTypeId: ent.leaveTypeId,
        daysPerYear: ent.daysPerYear,
      });
    }

    await batch.commit();

    // ---- 4. Write audit entries (best-effort) ------------------------------
    for (const lt of ltToCreate) {
      try {
        await writeAuditLog({
          actorId: actor.uid,
          actorRole: actor.role,
          action: "seed.create_leave_type",
          targetType: "LeaveType",
          targetId: lt.id,
        });
      } catch (err) {
        console.error("[peoplecore] Failed to write audit log for seed leave type:", err);
      }
    }

    for (const ent of entToCreate) {
      try {
        await writeAuditLog({
          actorId: actor.uid,
          actorRole: actor.role,
          action: "seed.create_leave_entitlement",
          targetType: "LeaveEntitlement",
          targetId: ent.leaveTypeId,
        });
      } catch (err) {
        console.error("[peoplecore] Failed to write audit log for seed entitlement:", err);
      }
    }

    // ---- 5. Respond --------------------------------------------------------
    res.status(201).json({
      message: "Seed data created successfully.",
      created: {
        leaveTypes: ltToCreate.length,
        leaveEntitlements: entToCreate.length,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const seedRouter = Router();

seedRouter.post("/", requireAuth, requireRole("admin"), seedData);
