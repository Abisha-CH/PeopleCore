// ---------------------------------------------------------------------------
// Shared mock for src/config/firebase, used by every test file via vi.mock.
// Exports the same named symbols the app imports: auth, db, FieldValue,
// verifyIdToken, adminApp.
// ---------------------------------------------------------------------------

import { MemoryFirestore, FieldValue } from "./memory-firestore";
import type { Role } from "../../src/types";

// ---- shared mutable state --------------------------------------------------

export const db = new MemoryFirestore();

export const tokenMap = new Map<
  string,
  { uid: string; email: string; role: Role }
>();

export const createdUsers: Array<{
  uid: string;
  email: string;
  password?: string;
  displayName?: string;
  claims?: { role: Role };
}> = [];

// ---- stubbed auth ----------------------------------------------------------

export const auth = {
  async createUser(data: {
    email: string;
    password: string;
    displayName?: string;
  }): Promise<{ uid: string; email: string | undefined }> {
    if (createdUsers.some((u) => u.email === data.email)) {
      const err = new Error(
        "The email address is already in use by another account.",
      ) as Error & { code: string };
      err.code = "auth/email-already-exists";
      throw err;
    }
    const uid = `test-uid-${createdUsers.length + 1}`;
    createdUsers.push({
      uid,
      email: data.email,
      password: data.password,
      displayName: data.displayName ?? "",
    });
    return { uid, email: data.email };
  },

  async setCustomUserClaims(
    uid: string,
    claims: { role: Role },
  ): Promise<void> {
    const user = createdUsers.find((u) => u.uid === uid);
    if (!user) throw new Error(`No user with uid ${uid}`);
    user.claims = claims;
  },

  async listUsers(_maxResults?: number, _pageToken?: string) {
    return {
      users: createdUsers.map((u) => ({
        uid: u.uid,
        email: u.email ?? null,
        displayName: u.displayName ?? null,
        customClaims: u.claims ?? null,
      })),
      pageToken: undefined as string | undefined,
    };
  },

  async getUser(uid: string) {
    const user = createdUsers.find((u) => u.uid === uid);
    return {
      uid,
      email: user?.email ?? `${uid}@example.com`,
      customClaims: user?.claims ?? null,
    };
  },

  async updateUser(uid: string, data: { email?: string }): Promise<{ uid: string; email?: string }> {
    const user = createdUsers.find((u) => u.uid === uid);
    if (!user) {
      const err = new Error(
        "The user record was not found.",
      ) as Error & { code: string };
      err.code = "auth/user-not-found";
      throw err;
    }
    if (data.email) {
      if (createdUsers.some((u) => u.email === data.email && u.uid !== uid)) {
        const err = new Error(
          "The email address is already in use by another account.",
        ) as Error & { code: string };
        err.code = "auth/email-already-exists";
        throw err;
      }
      user.email = data.email;
    }
    return { uid, email: user.email };
  },

  async deleteUser(uid: string): Promise<void> {
    const idx = createdUsers.findIndex((u) => u.uid === uid);
    if (idx !== -1) createdUsers.splice(idx, 1);
  },
};

export const adminApp = { name: "[TEST]" };

export { FieldValue };

// ---- token verification ----------------------------------------------------

export async function verifyIdToken(token: string) {
  const u = tokenMap.get(token);
  if (!u) {
    const err = new Error(
      "Firebase ID token has expired.",
    ) as Error & { code: string };
    err.code = "auth/id-token-expired";
    throw err;
  }
  return { uid: u.uid, email: u.email, role: u.role };
}

// ---- test helpers ----------------------------------------------------------

export function makeToken(uid: string, role: Role): string {
  const token = `test-token-${uid}-${role}`;
  tokenMap.set(token, { uid, email: `${uid}@example.com`, role });
  return token;
}

export function resetMock(): void {
  createdUsers.length = 0;
  db.reset();
}
