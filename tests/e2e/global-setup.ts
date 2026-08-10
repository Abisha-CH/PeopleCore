/**
 * Playwright globalSetup — provisions real E2E test users in Firebase Auth
 * and creates matching Employee documents in Firestore.
 *
 * This uses the Firebase Admin SDK — the exact same provisioning path as:
 *   - backend/src/services/provisioning.ts  (provisionAuthUser, provisionEmployee)
 *   - backend/src/scripts/create-admin.ts
 *   - POST /api/auth/setup                   (first-run bootstrap)
 *
 * No fake auth, no mocked tokens. Each user is a real Firebase Auth account
 * with the correct custom claim role and a real Employee document.
 *
 * Runs once before all projects. Idempotent — re-runs are safe and fast.
 */

import { join } from "node:path";
import { readFileSync } from "node:fs";
import { E2E_USERS } from "./config";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

/** Parse a simple KEY=VALUE env file (no interpolation, no quoting). */
function parseEnvFile(path: string): Record<string, string> {
  const result: Record<string, string> = {};
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m) result[m[1]] = m[2];
    }
  } catch {
    /* missing file — caller decides whether this is fatal */
  }
  return result;
}

/* -------------------------------------------------------------------------- */
/* Global setup                                                               */
/* -------------------------------------------------------------------------- */

export default async function globalSetup() {
  /* Load the backend's env so we use the exact same Firebase credentials
     the running backend uses. */
  const env = parseEnvFile(join(process.cwd(), "backend", ".env"));

  const saRelPath = env.GOOGLE_APPLICATION_CREDENTIALS;
  if (!saRelPath) {
    throw new Error(
      "[e2e] GOOGLE_APPLICATION_CREDENTIALS not set in backend/.env. " +
        "See README.md for environment setup.",
    );
  }

  const saAbsPath = join(process.cwd(), "backend", saRelPath);
  let serviceAccount: Record<string, unknown>;
  try {
    serviceAccount = JSON.parse(readFileSync(saAbsPath, "utf8"));
  } catch (err) {
    throw new Error(
      `[e2e] Cannot read service account at ${saAbsPath}. ` +
        `Download it from Firebase Console → Project Settings → Service accounts.`,
    );
  }

  /* Dynamically import firebase-admin so a missing package produces a clear
     error rather than a cryptic module-not-found at the top of the file. */
  const { initializeApp, cert } = await import("firebase-admin/app");
  const { getAuth } = await import("firebase-admin/auth");
  const { getFirestore } = await import("firebase-admin/firestore");

  const app = initializeApp(
    {
      credential: cert(serviceAccount as never),
      projectId: serviceAccount.project_id as string | undefined,
    },
    "e2e-global-setup",
  );

  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("[e2e] Provisioning test users...");

  for (const user of Object.values(E2E_USERS)) {
    /* ── 1. Auth user + custom claim ─────────────────────────────────────── */
    let uid: string;
    try {
      const existing = await auth.getUserByEmail(user.email);
      uid = existing.uid;
      const currentRole = (existing.customClaims as { role?: string } | null)
        ?.role;
      if (currentRole !== user.role) {
        await auth.setCustomUserClaims(uid, { role: user.role });
        console.log(`  [${user.role}] updated claim for ${user.email}`);
      }
    } catch (err: unknown) {
      if ((err as { code?: string }).code === "auth/user-not-found") {
        const rec = await auth.createUser({
          email: user.email,
          password: user.password,
          displayName: user.fullName,
        });
        uid = rec.uid;
        await auth.setCustomUserClaims(uid, { role: user.role });
        console.log(`  [${user.role}] created ${user.email} (uid=${uid})`);
      } else {
        throw err;
      }
    }

    /* ── 2. Employee document (mirrors provisionEmployee) ─────────────────── */
    const ref = db.collection("employees").doc(uid);
    const snap = await ref.get();
    if (!snap.exists) {
      await ref.set({
        employeeId: uid,
        fullName: user.fullName,
        email: user.email,
        phone: "",
        department: "Engineering",
        jobTitle:
          user.role === "admin"
            ? "Administrator"
            : user.role === "manager"
              ? "Team Lead"
              : "Developer",
        employmentRole: "full-time",
        startDate: new Date().toISOString().slice(0, 10),
        status: "active",
        nationalId: "",
        address: "",
      });
      console.log(`  [${user.role}] created Employee record for ${user.email}`);
    }
  }

  console.log("[e2e] Test users ready.");

  await app.delete();
}
