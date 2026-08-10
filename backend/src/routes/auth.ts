import { Router } from "express";
import type { RequestHandler } from "express";
import { auth, db } from "../config/firebase";
import { AppError } from "../errors";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { validateCreateAccount, validateSetup } from "../lib/validate";
import { provisionAuthUser } from "../services/provisioning";
import type { Role } from "../types";
import { writeRoute } from "./write";

const createAccount: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, role, displayName } = validateCreateAccount(
      req.body ?? {},
    );

    const user = await provisionAuthUser({ email, password, role, displayName });

    setAudit(res, {
      action: "auth.create_account",
      targetType: "User",
      targetId: user.uid,
    });

    setResult(res, 201, { uid: user.uid, email: user.email, role });
    next();
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/users?role=manager
 *
 * Lists every Firebase Auth user with their claim role. Used by the frontend to
 * populate the line-manager dropdown in the employee form. Restricted to admin.
 */
const listUsers: RequestHandler = async (req, res, next) => {
  try {
    const { role } = req.query;

    const result = await auth.listUsers(1000);
    let users = result.users
      .map((u) => ({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        role: ((u.customClaims as { role?: Role } | null)?.role ?? null) as
          | Role
          | null,
      }))
      .filter((u) => u.role !== null);

    if (typeof role === "string" && role.length > 0) {
      users = users.filter((u) => u.role === role);
    }

    users.sort((a, b) =>
      (a.displayName ?? a.email ?? "").localeCompare(
        b.displayName ?? b.email ?? "",
      ),
    );

    res.json({ users, total: users.length });
  } catch (err) {
    next(err);
  }
};

// ---- first-run bootstrap ----------------------------------------------------

/** True when at least one Firebase Auth user carries the `admin` claim. */
async function hasAnyAdmin(): Promise<boolean> {
  const result = await auth.listUsers(1000);
  return result.users.some(
    (u) => ((u.customClaims as { role?: Role } | null)?.role ?? null) === "admin",
  );
}

/**
 * GET /api/auth/setup-status
 *
 * Public. Lets the login page decide whether to show the "Set up your
 * workspace" first-run flow. No auth required — it must be callable before any
 * account exists.
 */
const setupStatus: RequestHandler = async (_req, res, next) => {
  try {
    const bootstrapped = await hasAnyAdmin();
    res.json({ bootstrapped });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/auth/setup
 *
 * Public. Creates the first HR Admin account (plus its Employee record) so the
 * workspace can be bootstrapped from the UI. Succeeds only while no admin
 * exists; afterwards it returns 409 so a stray request can never create a
 * second admin without going through an authenticated admin.
 */
const setup: RequestHandler = async (req, res, next) => {
  try {
    const { fullName, email, password } = validateSetup(req.body ?? {});

    if (await hasAnyAdmin()) {
      throw new AppError(
        409,
        "SETUP_COMPLETE",
        "Workspace already set up. Sign in with an existing account.",
      );
    }

    const user = await provisionAuthUser({
      email,
      password,
      role: "admin",
      displayName: fullName,
    });

    // The admin needs an Employee record so their own profile, dashboard, and
    // leave views resolve. Minimal record — fields are completed later via the
    // admin's own profile/employee tooling.
    await db.collection("employees").doc(user.uid).set({
      employeeId: user.uid,
      fullName,
      email: user.email,
      phone: "",
      department: "",
      jobTitle: "Administrator",
      employmentRole: "full-time",
      startDate: new Date().toISOString().slice(0, 10),
      status: "active",
      nationalId: "",
      address: "",
    });

    res.status(201).json({ uid: user.uid, email: user.email, role: "admin" });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/auth/me
 *
 * Authenticated. Returns the verified caller's identity from the ID token so
 * the frontend can validate the role it selected at sign-in against the
 * authoritative claim.
 */
const me: RequestHandler = (req, res) => {
  const actor = req.auth!;
  res.json({ uid: actor.uid, email: actor.email, role: actor.role });
};

export const authRouter = Router();

authRouter.get("/setup-status", setupStatus);
authRouter.post("/setup", setup);
authRouter.get("/me", requireAuth, me);
authRouter.post(
  "/create-account",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createAccount),
);
authRouter.get("/users", requireAuth, requireRole("admin"), listUsers);
