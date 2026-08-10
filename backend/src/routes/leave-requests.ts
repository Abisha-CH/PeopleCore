import { Router } from "express";
import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, FieldValue } from "../config/firebase";
import { AppError } from "../errors";
import { validateLeaveRequestInput, validateLeaveRequestUpdate } from "../lib/validate-leave-request";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { fetchLeaveType } from "../services/leave-config";
import { fetchEmployee } from "../services/employees";
import {
  computeNumberOfDays,
  computeUsedDays,
  fetchEffectiveEntitlement,
  fetchHolidayDates,
  hasOverlappingRequest,
} from "../services/leave-requests";
import type { LeaveRequest, LeaveRequestStatus, HalfDayPeriod, Role } from "../types";
import { writeRoute } from "./write";

// ---- helpers ----------------------------------------------------------------

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

function serialise(
  doc: {
    id: string;
    data(): Record<string, unknown> | undefined;
  },
  includeRejectionReasons = false,
): LeaveRequest {
  const data = doc.data();
  const base: LeaveRequest = {
    leaveRequestId: doc.id,
    employeeId: (data?.employeeId as string) ?? "",
    leaveTypeId: (data?.leaveTypeId as string) ?? "",
    startDate: (data?.startDate as string) ?? "",
    endDate: (data?.endDate as string) ?? "",
    isHalfDay: (data?.isHalfDay as boolean) ?? false,
    halfDayPeriod: data?.halfDayPeriod as HalfDayPeriod | undefined,
    numberOfDays: (data?.numberOfDays as number) ?? 0,
    reason: (data?.reason as string) ?? "",
    status: (data?.status as LeaveRequestStatus) ?? "pending",
    submittedAt: toIso(data?.submittedAt),
    managerId: data?.managerId as string | undefined,
    managerActionAt: toIso(data?.managerActionAt),
    reviewedBy: data?.reviewedBy as string | undefined,
    reviewedAt: toIso(data?.reviewedAt),
  };
  if (includeRejectionReasons) {
    return {
      ...base,
      managerRejectionReason: data?.managerRejectionReason as
        | string
        | undefined,
      rejectionReason: data?.rejectionReason as string | undefined,
    };
  }
  return base;
}

/**
 * Returns the set of employeeIds whose `lineManagerId` matches the given
 * manager, plus the manager's own employeeId so they can see their own
 * leave requests in the Leave Approvals page.
 */
async function fetchDirectReports(managerId: string): Promise<Set<string>> {
  const snap = await db
    .collection("employees")
    .where("lineManagerId", "==", managerId)
    .get();
  const ids = new Set<string>();
  for (const doc of snap.docs) {
    ids.add(doc.id);
  }
  // Include the manager themselves so they can see their own leave requests.
  ids.add(managerId);
  return ids;
}

function computeDiff(
  before: LeaveRequest,
  after: LeaveRequest,
): Record<string, { before: unknown; after: unknown }> {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    if (key === "leaveRequestId") continue;
    const b = before[key as keyof LeaveRequest];
    const a = after[key as keyof LeaveRequest];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}

// ---- handlers ---------------------------------------------------------------

/**
 * POST /leave-requests
 *
 * Employees, Line Managers, and HR Admin may each submit for themselves.
 * The employeeId is always taken from the authenticated token (SEC-03) —
 * there is no way to create a request on behalf of another user.
 *
 * Validation failures are surfaced as HTTP 400.
 */
const createLeaveRequest: RequestHandler = async (req, res, next) => {
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

    const input = validateLeaveRequestInput(req.body ?? {});

    // The submitting user must have an existing Employee record.
    await fetchEmployee(actor.uid);

    // The leave type must exist; map the generic 404 to 400.
    let leaveType;
    try {
      leaveType = await fetchLeaveType(input.leaveTypeId);
    } catch (err) {
      if (err instanceof AppError && err.statusCode === 404) {
        throw new AppError(
          400,
          "INVALID_LEAVE_TYPE_ID",
          "Leave type does not exist.",
        );
      }
      throw err;
    }

    const holidayDates = await fetchHolidayDates();
    const numberOfDays = computeNumberOfDays(
      input.startDate,
      input.endDate,
      input.isHalfDay,
      holidayDates,
    );

    // Capped leave types: an entitlement must exist and the balance must not
    // be exceeded.  (LEAVE-17, Ticket 05 acceptance criteria.)
    if (leaveType.isCapped) {
      const effectiveDays = await fetchEffectiveEntitlement(
        actor.uid,
        input.leaveTypeId,
      );
      if (effectiveDays === null) {
        throw new AppError(
          400,
          "NO_ENTITLEMENT",
          "No leave entitlement is configured for this leave type.",
        );
      }

      const year = Number(input.startDate.slice(0, 4));
      const usedDays = await computeUsedDays(
        actor.uid,
        input.leaveTypeId,
        year,
      );
      if (usedDays + numberOfDays > effectiveDays) {
        throw new AppError(
          400,
          "BALANCE_EXCEEDED",
          "This request exceeds the remaining leave balance for the year.",
        );
      }
    }

    // No overlapping active request may already exist for the same dates.
    // Cancelled and rejected requests are excluded from the overlap check.
    if (await hasOverlappingRequest(actor.uid, input.startDate, input.endDate)) {
      throw new AppError(
        409,
        "OVERLAPPING_REQUEST",
        "An active leave request already overlaps these dates.",
      );
    }

    // Persist the new request.
    const ref = db.collection("leaveRequests").doc();
    const record: Record<string, unknown> = {
      employeeId: actor.uid,
      leaveTypeId: input.leaveTypeId,
      startDate: input.startDate,
      endDate: input.endDate,
      isHalfDay: input.isHalfDay,
      numberOfDays,
      reason: input.reason,
      status: "pending",
      submittedAt: FieldValue.serverTimestamp(),
    };
    if (input.isHalfDay) {
      record.halfDayPeriod = input.halfDayPeriod;
    }

    await ref.set(record);
    const created = await ref.get();
    const leaveRequest = serialise(created, true);

    setAudit(res, {
      action: "leave_request.create",
      targetType: "LeaveRequest",
      targetId: ref.id,
    });
    setResult(res, 201, { leaveRequest });
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /leave-requests
 *
 * HR Admin sees all; Line Manager sees only requests from their direct
 * reports (LEAVE-19); Employee sees only own (LEAVE-20).
 *
 * Optional query filters: `status`, `leaveTypeId` (LEAVE-18).
 */
const listLeaveRequests: RequestHandler = async (req, res, next) => {
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

    const snap = await db.collection("leaveRequests").get();

    let directReports: Set<string> | null = null;
    if (actor.role === "manager") {
      directReports = await fetchDirectReports(actor.uid);
    }

    let requests = snap.docs
      .map((d) => {
        const isDirectReport =
          actor.role === "manager" && directReports?.has(d.data()?.employeeId);
        return serialise(d, actor.role === "admin" || isDirectReport);
      })
      .sort(
        (a, b) => (b.submittedAt ?? "").localeCompare(a.submittedAt ?? ""),
      );

    // ---- role-based scoping (SEC-03, LEAVE-18/19/20) ------------------------

    if (actor.role === "admin") {
      // HR Admin: no further scoping; sees everything.
    } else if (actor.role === "manager") {
      requests = requests.filter((r) => directReports!.has(r.employeeId));
    } else {
      // Employee: own requests only.
      requests = requests.filter((r) => r.employeeId === actor.uid);
    }

    // ---- optional filters (LEAVE-18) ----------------------------------------

    const { status, leaveTypeId } = req.query;
    if (typeof status === "string" && status.length > 0) {
      requests = requests.filter((r) => r.status === status);
    }
    if (typeof leaveTypeId === "string" && leaveTypeId.length > 0) {
      requests = requests.filter((r) => r.leaveTypeId === leaveTypeId);
    }

    res.json({ leaveRequests: requests, total: requests.length });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /leave-requests/:id
 *
 * HR Admin may view any request.  Line Manager may view only requests
 * submitted by their direct reports (SEC-08).  Employee may view only own.
 */
const getLeaveRequest: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
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

    const doc = await db.collection("leaveRequests").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Leave request not found.");
    }

    if (actor.role === "admin") {
      res.json({ leaveRequest: serialise(doc, true) });
      return;
    }

    if (actor.role === "manager") {
      // Verify the employee is a direct report.
      const requesterId = (doc.data()?.employeeId as string) ?? "";
      const employee = await fetchEmployee(requesterId);
      if (employee.lineManagerId === actor.uid) {
        // Managers see rejection reasons for their direct reports' requests.
        res.json({ leaveRequest: serialise(doc, true) });
        return;
      }
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message:
            "You may only view leave requests from your direct reports.",
        },
      });
      return;
    }

    // Employee: own requests only.
    const employeeId = (doc.data()?.employeeId as string) ?? "";
    if (employeeId === actor.uid) {
      res.json({ leaveRequest: serialise(doc, false) });
      return;
    }
    res.status(403).json({
      error: {
        code: "FORBIDDEN",
        message: "You may only view your own leave requests.",
      },
    });
  } catch (err) {
    next(err);
  }
};

// ---- shared status-transition helper ----------------------------------------

type TransitionResult = {
  target: LeaveRequestStatus;
  update: Record<string, unknown>;
  action: string;
};

type TransitionResolver = (params: {
  actor: { uid: string; role: Role };
  leaveRequest: LeaveRequest;
  body: Record<string, unknown>;
}) => TransitionResult | Promise<TransitionResult>;

/**
 * Shared plumbing for PATCH /leave-requests/:id/status.
 *
 * Handles 401 / 404, persistence, re-read, audit, and response.  Role-specific
 * transition logic lives in the `resolve` callback so the Line Manager first
 * stage (Ticket 07) and HR Admin final stage (Ticket 08) share one code path
 * without duplicating the write / audit / respond dance.
 */
async function runStatusTransition(
  req: Request,
  res: Response,
  next: NextFunction,
  resolve: TransitionResolver,
): Promise<void> {
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

    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db.collection("leaveRequests").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Leave request not found.");
    }
    // Include rejection reasons for admin and manager — the actor just made the
    // decision and needs to see what they set.
    const includeReasons = actor.role === "admin" || actor.role === "manager";
    const leaveRequest = serialise(doc, includeReasons);

    const result = await resolve({
      actor,
      leaveRequest,
      body: (req.body ?? {}) as Record<string, unknown>,
    });

    await db.collection("leaveRequests").doc(id).update(result.update);

    const updated = await db.collection("leaveRequests").doc(id).get();
    const updatedLeaveRequest = serialise(updated, includeReasons);

    setAudit(res, {
      action: result.action,
      targetType: "LeaveRequest",
      targetId: id,
      diff: { status: { before: leaveRequest.status, after: result.target } },
    });
    setResult(res, 200, { leaveRequest: updatedLeaveRequest });
    next();
  } catch (err) {
    next(err);
  }
}

// ---- Line Manager first-stage resolver (Ticket 07) -------------------------

async function resolveManagerTransition({
  actor,
  leaveRequest,
  body,
}: {
  actor: { uid: string; role: Role };
  leaveRequest: LeaveRequest;
  body: Record<string, unknown>;
}): Promise<TransitionResult> {
  // Scope: employee's lineManagerId must match acting manager.
  const employee = await fetchEmployee(leaveRequest.employeeId);
  if (employee.lineManagerId !== actor.uid) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You may only act on leave requests from your direct reports.",
    );
  }

  // Only pending requests can be actioned at first stage.
  if (leaveRequest.status !== "pending") {
    throw new AppError(
      400,
      "INVALID_STATUS_TRANSITION",
      "Only pending leave requests can be actioned.",
    );
  }

  const target = body.status;
  if (target !== "manager_approved" && target !== "rejected") {
    throw new AppError(
      400,
      "INVALID_STATUS",
      "status must be 'manager_approved' or 'rejected'.",
    );
  }

  const update: Record<string, unknown> = {
    status: target,
    managerId: actor.uid,
    managerActionAt: FieldValue.serverTimestamp(),
  };

  if (target === "rejected") {
    const reason = body.managerRejectionReason;
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new AppError(
        400,
        "INVALID_MANAGER_REJECTION_REASON",
        "managerRejectionReason is required when rejecting.",
      );
    }
    update.managerRejectionReason = reason.trim();
  }

  return {
    target: target as LeaveRequestStatus,
    update,
    action:
      target === "manager_approved"
        ? "leave_request.manager_approve"
        : "leave_request.manager_reject",
  };
}

// ---- HR Admin final-stage resolver (Ticket 08) -----------------------------

async function resolveAdminTransition({
  actor,
  leaveRequest,
  body,
}: {
  actor: { uid: string; role: Role };
  leaveRequest: LeaveRequest;
  body: Record<string, unknown>;
}): Promise<TransitionResult> {
  const target = body.status;
  if (target !== "approved" && target !== "rejected") {
    throw new AppError(
      400,
      "INVALID_STATUS",
      "status must be 'approved' or 'rejected'.",
    );
  }

  if (leaveRequest.status === "manager_approved") {
    // Standard two-stage path — valid.
  } else if (leaveRequest.status === "pending") {
    // Direct path: only allowed when no Line Manager is assigned (LEAVE-13, C-09).
    const employee = await fetchEmployee(leaveRequest.employeeId);
    if (employee.lineManagerId) {
      throw new AppError(
        400,
        "INVALID_STATUS_TRANSITION",
        "This request must first be reviewed by the employee's Line Manager.",
      );
    }
  } else {
    throw new AppError(
      400,
      "INVALID_STATUS_TRANSITION",
      "Only manager_approved (or pending without a Line Manager) leave requests can be actioned.",
    );
  }

  const update: Record<string, unknown> = {
    status: target,
    reviewedBy: actor.uid,
    reviewedAt: FieldValue.serverTimestamp(),
  };

  if (target === "rejected") {
    const reason = body.rejectionReason;
    if (typeof reason !== "string" || reason.trim().length === 0) {
      throw new AppError(
        400,
        "INVALID_REJECTION_REASON",
        "rejectionReason is required when rejecting.",
      );
    }
    update.rejectionReason = reason.trim();
  }

  return {
    target: target as LeaveRequestStatus,
    update,
    action:
      target === "approved"
        ? "leave_request.approve"
        : "leave_request.reject",
  };
}

// ---- Employee cancellation resolver (Ticket 09) -----------------------------

async function resolveCancellationTransition({
  actor,
  leaveRequest,
  body,
}: {
  actor: { uid: string; role: Role };
  leaveRequest: LeaveRequest;
  body: Record<string, unknown>;
}): Promise<TransitionResult> {
  // Scope: only the owning employee may cancel their request (SEC-03).
  if (leaveRequest.employeeId !== actor.uid) {
    throw new AppError(
      403,
      "FORBIDDEN",
      "You may only cancel your own leave requests.",
    );
  }

  // Only pending requests can be cancelled (LEAVE-16, UC-08).
  if (leaveRequest.status !== "pending") {
    throw new AppError(
      400,
      "INVALID_STATUS_TRANSITION",
      "Only pending leave requests can be cancelled.",
    );
  }

  const target = body.status;
  if (target !== "cancelled") {
    throw new AppError(400, "INVALID_STATUS", "status must be 'cancelled'.");
  }

  return {
    target: "cancelled",
    update: { status: "cancelled" },
    action: "leave_request.cancel",
  };
}

// ---- PATCH handler (shared entry point) -------------------------------------

/**
 * Routes a PATCH /:id/status request to the resolver matching the actor's
 * role and the request's ownership:
 *
 *  - HR Admin                 → final approval / rejection (Ticket 08)
 *  - Request owner (Employee, or Line Manager cancelling a request they
 *    submitted)               → cancellation (Ticket 09)
 *  - Line Manager             → first-stage approval / rejection (Ticket 07)
 *
 * An Employee acting on another employee's request is rejected with 403.
 */
async function resolveTransition({
  actor,
  leaveRequest,
  body,
}: {
  actor: { uid: string; role: Role };
  leaveRequest: LeaveRequest;
  body: Record<string, unknown>;
}): Promise<TransitionResult> {
  if (actor.role === "admin") {
    return resolveAdminTransition({ actor, leaveRequest, body });
  }

  // The owner may only cancel their own request while it is pending.
  if (leaveRequest.employeeId === actor.uid) {
    return resolveCancellationTransition({ actor, leaveRequest, body });
  }

  if (actor.role === "manager") {
    return resolveManagerTransition({ actor, leaveRequest, body });
  }

  throw new AppError(
    403,
    "FORBIDDEN",
    "You may only cancel your own leave requests.",
  );
}

/**
 * PATCH /leave-requests/:id/status
 *
 * Line Manager first-stage approval (LEAVE-11/12), HR Admin final approval
 * (LEAVE-13/14), or Employee self-cancellation of a pending request
 * (LEAVE-16).  The role gate allows all three roles; ownership for
 * cancellation is enforced inside `resolveTransition`.
 *
 * Request body: `{ status: "<target>" }`, plus a rejection reason when
 * rejecting (role-dependent field name).
 */
const updateLeaveRequestStatus: RequestHandler = (req, res, next) => {
  return runStatusTransition(req, res, next, resolveTransition);
};

// ---- PUT handler (HR Admin override, LEAVE-15) ------------------------------

/**
 * PUT /leave-requests/:id
 *
 * HR Admin may modify any field on any leave request regardless of status
 * (LEAVE-15).  This is a correction / override tool — entitlement checks and
 * balance validation are NOT re-run so the Admin retains unrestricted power.
 *
 * Only the following substantive fields are accepted: employeeId, leaveTypeId,
 * startDate, endDate, isHalfDay, halfDayPeriod, numberOfDays, reason, status.
 * System / attribution fields (submittedAt, manager*, reviewed*) are written
 * exclusively by the workflow to preserve the audit trail.
 */
const updateLeaveRequest: RequestHandler = async (req, res, next) => {
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

    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db.collection("leaveRequests").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Leave request not found.");
    }
    const existing = serialise(doc);

    const patch = validateLeaveRequestUpdate(req.body ?? {});

    if (Object.keys(patch).length === 0) {
      setResult(res, 200, { leaveRequest: existing });
      next();
      return;
    }

    const merged: LeaveRequest = {
      ...existing,
      ...(patch as Partial<LeaveRequest>),
    };
    const diff = computeDiff(existing, merged);

    await db.collection("leaveRequests").doc(id).update(patch);

    const updated = await db.collection("leaveRequests").doc(id).get();
    const updatedLeaveRequest = serialise(updated, actor.role === "admin");

    setAudit(res, {
      action: "leave_request.update",
      targetType: "LeaveRequest",
      targetId: id,
      ...(Object.keys(diff).length > 0 ? { diff } : {}),
    });
    setResult(res, 200, { leaveRequest: updatedLeaveRequest });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- DELETE handler (HR Admin override, LEAVE-15) ---------------------------

/**
 * DELETE /leave-requests/:id
 *
 * HR Admin may delete any leave request regardless of its current status
 * (LEAVE-15).  The deleted request is returned for the client to remove from
 * its local state.  An audit entry is written for traceability.
 */
const deleteLeaveRequest: RequestHandler = async (req, res, next) => {
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

    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db.collection("leaveRequests").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Leave request not found.");
    }
    const existing = serialise(doc);

    await db.collection("leaveRequests").doc(id).delete();

    setAudit(res, {
      action: "leave_request.delete",
      targetType: "LeaveRequest",
      targetId: id,
    });
    setResult(res, 200, { leaveRequest: existing });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const leaveRequestsRouter = Router();

leaveRequestsRouter.post(
  "/",
  requireAuth,
  requireRole("admin", "manager", "employee"),
  ...writeRoute(createLeaveRequest),
);

leaveRequestsRouter.get("/", requireAuth, listLeaveRequests);

leaveRequestsRouter.get("/:id", requireAuth, getLeaveRequest);

leaveRequestsRouter.patch(
  "/:id/status",
  requireAuth,
  requireRole("admin", "manager", "employee"),
  ...writeRoute(updateLeaveRequestStatus),
);

leaveRequestsRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updateLeaveRequest),
);

leaveRequestsRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deleteLeaveRequest),
);
