import { Router } from "express";
import type { RequestHandler } from "express";
import { auth, db } from "../config/firebase";
import { AppError } from "../errors";
import {
  validateEmployeeCreate,
  validateEmployeeUpdate,
  validatePhoneUpdate,
  type EmployeeBusinessInput,
} from "../lib/validate-employee";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import {
  provisionEmployee,
  updateAuthEmail,
} from "../services/provisioning";
import {
  fetchEmployee,
  toEmployee,
  buildEmployeeNameMap,
  attachLineManagerNames,
  resolveLineManagerName,
} from "../services/employees";
import type { EmployeeRecord } from "../types";
import { writeRoute } from "./write";

function buildEmployeeRecord(
  id: string,
  input: EmployeeBusinessInput,
): EmployeeRecord {
  const record: EmployeeRecord = {
    employeeId: id,
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    department: input.department,
    jobTitle: input.jobTitle,
    employmentRole: input.employmentRole,
    startDate: input.startDate,
    status: input.status,
    nationalId: input.nationalId,
    address: input.address,
  };
  if (input.emergencyContact) record.emergencyContact = input.emergencyContact;
  if (input.lineManagerId) record.lineManagerId = input.lineManagerId;
  return record;
}

function computeDiff(
  before: EmployeeRecord,
  after: EmployeeRecord,
): Record<string, { before: unknown; after: unknown }> {
  const keys = new Set<string>([...Object.keys(before), ...Object.keys(after)]);
  const diff: Record<string, { before: unknown; after: unknown }> = {};
  for (const key of keys) {
    if (key === "employeeId") continue;
    const b = before[key as keyof EmployeeRecord];
    const a = after[key as keyof EmployeeRecord];
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      diff[key] = { before: b, after: a };
    }
  }
  return diff;
}

// ---- validation helpers -----------------------------------------------------

/** lineManagerId must reference a user whose claim role is `manager`. */
async function assertValidLineManager(
  lineManagerId: string | undefined,
): Promise<void> {
  if (!lineManagerId) return;

  try {
    const user = await auth.getUser(lineManagerId);
    const claims = user.customClaims as { role?: string } | null | undefined;
    if (claims?.role !== "manager") {
      throw new AppError(
        400,
        "INVALID_LINE_MANAGER",
        "Line manager must be a user with the manager role.",
      );
    }
  } catch (err) {
    if (err instanceof AppError) throw err;
    throw new AppError(
      400,
      "INVALID_LINE_MANAGER",
      "Line manager must reference an existing user with the manager role.",
    );
  }
}

// ---- handlers ---------------------------------------------------------------

const createEmployee: RequestHandler = async (req, res, next) => {
  try {
    const input = validateEmployeeCreate(req.body ?? {});
    await assertValidLineManager(input.lineManagerId);

    const employee = await provisionEmployee(input);

    setAudit(res, {
      action: "employee.create",
      targetType: "Employee",
      targetId: employee.employeeId,
    });
    setResult(res, 201, { employee });
    next();
  } catch (err) {
    next(err);
  }
};

const listEmployees: RequestHandler = async (req, res) => {
  const { status, department } = req.query;
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

  const snap = await db.collection("employees").get();

  let employees = snap.docs
    .map((doc) => toEmployee(doc))
    .filter((e): e is EmployeeRecord => e !== null);

  // Scope results by role
  if (actor.role === "manager") {
    // Managers see their direct reports + themselves
    const directReportIds = new Set<string>();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (data?.lineManagerId === actor.uid) directReportIds.add(doc.id);
    }
    directReportIds.add(actor.uid);
    employees = employees.filter((e) => directReportIds.has(e.employeeId));
  } else if (actor.role !== "admin") {
    // Employees see only themselves
    employees = employees.filter((e) => e.employeeId === actor.uid);
  }

  if (typeof status === "string" && status.length > 0) {
    employees = employees.filter((e) => e.status === status);
  }
  if (typeof department === "string" && department.length > 0) {
    employees = employees.filter((e) => e.department === department);
  }

  // Resolve lineManagerId -> fullName from the same snapshot (no extra reads).
  const namesById = buildEmployeeNameMap(snap.docs);
  employees = attachLineManagerNames(employees, namesById);

  employees.sort((a, b) => a.fullName.localeCompare(b.fullName));

  res.json({ employees, total: employees.length });
};

const getEmployee: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const employee = await fetchEmployee(id);

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

    // HR Admin reads any record; Employees and Line Managers read their own only.
    if (actor.role !== "admin" && actor.uid !== id) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You do not have permission to view this employee record.",
        },
      });
      return;
    }

    // Resolve the line manager's name (one extra read, only when assigned).
    const withManager = await resolveLineManagerName(employee);

    res.json({ employee: withManager });
  } catch (err) {
    next(err);
  }
};

const updateEmployee: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const input = validateEmployeeUpdate(req.body ?? {});
    await assertValidLineManager(input.lineManagerId);

    const existing = await fetchEmployee(id);

    if (input.email !== existing.email) {
      await updateAuthEmail(id, input.email);
    }

    const nextRecord = buildEmployeeRecord(id, input);
    const diff = computeDiff(existing, nextRecord);

    await db.collection("employees").doc(id).set(nextRecord);

    setAudit(res, {
      action: "employee.update",
      targetType: "Employee",
      targetId: id,
      diff,
    });
    setResult(res, 200, { employee: nextRecord });
    next();
  } catch (err) {
    next(err);
  }
};

const deleteEmployee: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const existing = await fetchEmployee(id);

    // Soft delete: keep the record, mark it inactive (never hard-delete).
    if (existing.status === "inactive") {
      setResult(res, 200, { employee: existing });
      next();
      return;
    }

    const updated: EmployeeRecord = { ...existing, status: "inactive" };
    await db.collection("employees").doc(id).update({ status: "inactive" });

    setAudit(res, {
      action: "employee.delete",
      targetType: "Employee",
      targetId: id,
      diff: { status: { before: existing.status, after: "inactive" } },
    });
    setResult(res, 200, { employee: updated });
    next();
  } catch (err) {
    next(err);
  }
};

const updateOwnPhone: RequestHandler = async (req, res, next) => {
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

    // Employees may only touch their own record.
    if (actor.uid !== id) {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You may only update your own phone number.",
        },
      });
      return;
    }

    // The payload may contain exactly one field: phone.
    const body = req.body ?? {};
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== "phone") {
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "You may only update your phone number.",
        },
      });
      return;
    }

    const { phone } = validatePhoneUpdate(body);
    const existing = await fetchEmployee(id);

    if (existing.phone === phone) {
      setResult(res, 200, { employee: existing });
      next();
      return;
    }

    await db.collection("employees").doc(id).update({ phone });
    const updated: EmployeeRecord = { ...existing, phone };

    setAudit(res, {
      action: "employee.update",
      targetType: "Employee",
      targetId: id,
      diff: { phone: { before: existing.phone, after: phone } },
    });
    setResult(res, 200, { employee: updated });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const employeesRouter = Router();

employeesRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createEmployee),
);
employeesRouter.get("/", requireAuth, requireRole("admin", "manager"), listEmployees);
employeesRouter.get("/:id", requireAuth, getEmployee);
employeesRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updateEmployee),
);
employeesRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deleteEmployee),
);
employeesRouter.patch(
  "/:id/phone",
  requireAuth,
  ...writeRoute(updateOwnPhone),
);
