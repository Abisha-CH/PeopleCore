/**
 * Bootstrap script: creates the initial HR Admin account.
 *
 * Usage:
 *   EMAIL=admin@example.com PASSWORD=changeme tsx src/scripts/create-admin.ts
 */

import "dotenv/config";
import { auth as adminAuth } from "../config/firebase";

const email = process.env.EMAIL;
const password = process.env.PASSWORD;

if (!email || !password) {
  console.error("Set EMAIL and PASSWORD environment variables.");
  process.exit(1);
}

async function main() {
  try {
    const user = await adminAuth.createUser({ email, password });
    await adminAuth.setCustomUserClaims(user.uid, { role: "admin" });
    console.log(`Created admin account: uid=${user.uid}, email=${email}`);
  } catch (err) {
    console.error("Failed to create admin account:", err);
    process.exit(1);
  }
}

main();
