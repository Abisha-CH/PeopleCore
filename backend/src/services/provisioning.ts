import { auth, db } from "../config/firebase";
import type { EmployeeRecord, Role } from "../types";

/**
 * Remove keys whose value is `undefined` so Firestore's document validator
 * (which rejects `undefined` by default in `@google-cloud/firestore`) does
 * not throw.
 */
function stripUndefined<T extends object>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[k] = v;
  }
  return out as T;
}

/**
 * Shared account-provisioning helpers.
 *
 * The single place that turns an email/password/role into a Firebase Auth user
 * with the matching custom claim, so POST /auth/create-account and
 * POST /employees never duplicate that logic.
 */

export interface ProvisionAuthUserInput {
  email: string;
  password: string;
  role: Role;
  displayName?: string;
}

export interface ProvisionedUser {
  uid: string;
  email: string;
}

export async function provisionAuthUser(
  input: ProvisionAuthUserInput,
): Promise<ProvisionedUser> {
  const user = await auth.createUser({
    email: input.email,
    password: input.password,
    displayName: input.displayName ?? "",
  });
  await auth.setCustomUserClaims(user.uid, { role: input.role });
  return { uid: user.uid, email: user.email ?? input.email };
}

export async function deleteAuthUser(uid: string): Promise<void> {
  await auth.deleteUser(uid);
}

export async function updateAuthEmail(uid: string, email: string): Promise<void> {
  await auth.updateUser(uid, { email });
}

/**
 * Creates the Firebase Auth account and the Employee document in one flow.
 *
 * Auth and Firestore are separate systems, so this can't be a single
 * transaction. To keep the two in sync we use a compensating rollback: if the
 * Employee document write fails, the freshly created Auth user is deleted so we
 * never leave an orphan account behind.
 */
export type EmployeeProvisionInput = Omit<EmployeeRecord, "employeeId"> & {
  password: string;
  /** Firebase claim role to grant this user. Defaults to "employee". */
  role?: Role;
};

export async function provisionEmployee(
  input: EmployeeProvisionInput,
): Promise<EmployeeRecord> {
  const user = await provisionAuthUser({
    email: input.email,
    password: input.password,
    role: input.role ?? "employee",
    displayName: input.fullName,
  });

  // role lives in the Auth custom claim, never in the Employee document.
  const { password: _password, role: _role, ...businessFields } = input;
  const employee: EmployeeRecord = {
    employeeId: user.uid,
    ...businessFields,
  };

  try {
    // Strip keys with `undefined` values — Firestore's `@google-cloud/firestore`
    // validator throws a plain Error when it encounters `undefined` and
    // `ignoreUndefinedProperties` is not enabled (firebase-admin does not expose
    // this setting through its own API).
    await db.collection("employees").doc(user.uid).set(stripUndefined(employee));
  } catch (err) {
    await deleteAuthUser(user.uid).catch(() => {});
    throw err;
  }

  return employee;
}
