import "dotenv/config";
import fs from "node:fs";
import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, FieldValue, type Firestore } from "firebase-admin/firestore";

function loadServiceAccount(): Record<string, unknown> | null {
  const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (credentialsPath) {
    try {
      return JSON.parse(fs.readFileSync(credentialsPath, "utf8"));
    } catch (err) {
      console.warn(
        `[peoplecore] Unable to read service account at ${credentialsPath}:`,
        (err as Error).message,
      );
    }
  }

  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (json) {
    try {
      return JSON.parse(json);
    } catch {
      console.warn("[peoplecore] FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON.");
    }
  }

  return null;
}

function resolveProjectId(sa: Record<string, unknown> | null): string {
  return (
    (sa?.project_id as string) ??
    process.env.FIREBASE_PROJECT_ID ??
    process.env.GOOGLE_CLOUD_PROJECT ??
    "peoplecore"
  );
}

function createAdminApp(): App {
  const existing = getApps()[0];
  if (existing) return existing;

  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    console.warn(
      "[peoplecore] No Firebase service account configured. Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON.",
    );
  }

  return initializeApp(
    {
      credential: serviceAccount ? cert(serviceAccount as never) : undefined,
      projectId: resolveProjectId(serviceAccount),
    },
    "peoplecore",
  );
}

export const adminApp = createAdminApp();
export const auth: Auth = getAuth(adminApp);
export const db: Firestore = getFirestore(adminApp);
export { FieldValue };

export async function verifyIdToken(token: string) {
  return auth.verifyIdToken(token);
}
