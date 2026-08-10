import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

// Mock the firebase config before importing the app
vi.mock("../src/config/firebase", async () => await import("./helpers/firebase-mock"));

import { createApp } from "../src/app";
import {
  makeToken,
  resetMock,
  createdUsers,
  db,
} from "./helpers/firebase-mock";

const app = createApp();
const adminToken = makeToken("admin-1", "admin");
const managerToken = makeToken("manager-1", "manager");
const employeeToken = makeToken("employee-1", "employee");

beforeEach(() => {
  resetMock();
});

describe("POST /api/auth/create-account", () => {
  it("creates an account with the correct role claim (admin)", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "ana@example.com", password: "secret123", role: "admin" });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      email: "ana@example.com",
      role: "admin",
    });
    expect(res.body.uid).toEqual(expect.any(String));

    const user = createdUsers.find((u) => u.email === "ana@example.com");
    expect(user?.claims).toEqual({ role: "admin" });
  });

  it("creates a manager account with the manager claim", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "mgr@example.com", password: "secret123", role: "manager" });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("manager");

    const user = createdUsers.find((u) => u.email === "mgr@example.com");
    expect(user?.claims).toEqual({ role: "manager" });
  });

  it("creates an employee account with the employee claim", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "emp@example.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(201);
    expect(res.body.role).toBe("employee");

    const user = createdUsers.find((u) => u.email === "emp@example.com");
    expect(user?.claims).toEqual({ role: "employee" });
  });

  it("writes an audit log entry on successful creation", async () => {
    const createRes = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "audit@example.com", password: "secret123", role: "employee" });

    expect(createRes.status).toBe(201);
    const uid = createRes.body.uid;

    const auditRes = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    expect(auditRes.body.entries.length).toBeGreaterThanOrEqual(1);

    const entry = auditRes.body.entries.find(
      (e: { targetId: string }) => e.targetId === uid,
    );
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      actorId: "admin-1",
      actorRole: "admin",
      action: "auth.create_account",
      targetType: "User",
      targetId: uid,
    });
    expect(entry.auditLogId).toEqual(expect.any(String));
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it("returns 409 for duplicate email", async () => {
    await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "dup@example.com", password: "secret123", role: "employee" });

    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "dup@example.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "a@b.com", password: "secret123", role: "superadmin" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ROLE");
  });

  it("returns 400 for weak password (too short)", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "a@b.com", password: "ab", role: "employee" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("WEAK_PASSWORD");
  });

  it("returns 400 for invalid email", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "not-an-email", password: "secret123", role: "employee" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EMAIL");
  });

  it("returns 400 for missing fields", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({});

    expect(res.status).toBe(400);
  });
});

describe("GET /api/auth/users", () => {
  async function provisionUser(
    email: string,
    role: "admin" | "manager" | "employee",
  ) {
    return request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email, password: "secret123", role });
  }

  it("lists users with their claim role", async () => {
    await provisionUser("mgr@example.com", "manager");
    await provisionUser("emp@example.com", "employee");

    const res = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    const byEmail = Object.fromEntries(
      res.body.users.map((u: { email: string; role: string }) => [
        u.email,
        u.role,
      ]),
    );
    expect(byEmail).toMatchObject({
      "mgr@example.com": "manager",
      "emp@example.com": "employee",
    });
  });

  it("filters users by role", async () => {
    await provisionUser("mgr@example.com", "manager");
    await provisionUser("emp@example.com", "employee");

    const res = await request(app)
      .get("/api/auth/users?role=manager")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.users[0]).toMatchObject({
      email: "mgr@example.com",
      role: "manager",
    });
    expect(res.body.users[0].uid).toEqual(expect.any(String));
  });

  it("returns an empty list when no user matches the filter", async () => {
    const res = await request(app)
      .get("/api/auth/users?role=manager")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
    expect(res.body.users).toEqual([]);
  });

  it("returns 403 for non-admin roles", async () => {
    const res = await request(app)
      .get("/api/auth/users")
      .set("Authorization", `Bearer ${employeeToken}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/users");
    expect(res.status).toBe(401);
  });
});

describe("authentication enforcement", () => {
  it("returns 401 when no token is provided", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .send({ email: "a@b.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("returns 401 for an invalid token", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", "Bearer not-a-real-token")
      .send({ email: "a@b.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(401);
  });

  it("returns 403 when a manager tries to create an account", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${managerToken}`)
      .send({ email: "a@b.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 when an employee tries to create an account", async () => {
    const res = await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ email: "a@b.com", password: "secret123", role: "employee" });

    expect(res.status).toBe(403);
  });
});

// ---- first-run bootstrap ----------------------------------------------------

describe("GET /api/auth/setup-status", () => {
  it("reports bootstrapped=false when no admin exists", async () => {
    const res = await request(app).get("/api/auth/setup-status");
    expect(res.status).toBe(200);
    expect(res.body.bootstrapped).toBe(false);
  });

  it("reports bootstrapped=true when an admin exists", async () => {
    await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "root@example.com", password: "secret123", role: "admin" });

    const res = await request(app).get("/api/auth/setup-status");
    expect(res.status).toBe(200);
    expect(res.body.bootstrapped).toBe(true);
  });

  it("requires no authentication", async () => {
    // Must be callable before any account exists — no token on purpose.
    const res = await request(app).get("/api/auth/setup-status");
    expect(res.status).toBe(200);
  });
});

describe("POST /api/auth/setup", () => {
  it("creates the first admin account and its employee record", async () => {
    const res = await request(app).post("/api/auth/setup").send({
      fullName: "First Admin",
      email: "first@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email: "first@example.com", role: "admin" });
    expect(res.body.uid).toEqual(expect.any(String));

    const user = createdUsers.find((u) => u.email === "first@example.com");
    expect(user?.claims).toEqual({ role: "admin" });
    expect(user?.displayName).toBe("First Admin");

    // An Employee record exists so the admin's own profile/dashboard resolve.
    const doc = await db.collection("employees").doc(res.body.uid).get();
    expect(doc.exists).toBe(true);
    const data = doc.data();
    expect(data).toMatchObject({
      employeeId: res.body.uid,
      fullName: "First Admin",
      email: "first@example.com",
      status: "active",
    });
  });

  it("returns 409 once the workspace is already bootstrapped", async () => {
    // Bootstrap once.
    await request(app).post("/api/auth/setup").send({
      fullName: "First Admin",
      email: "first@example.com",
      password: "secret123",
    });

    // A second setup (even unauthenticated) must fail.
    const res = await request(app).post("/api/auth/setup").send({
      fullName: "Second Admin",
      email: "second@example.com",
      password: "secret123",
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("SETUP_COMPLETE");
  });

  it("rejects a weak password", async () => {
    const res = await request(app).post("/api/auth/setup").send({
      fullName: "First Admin",
      email: "first@example.com",
      password: "123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("WEAK_PASSWORD");
  });

  it("rejects an invalid email", async () => {
    const res = await request(app).post("/api/auth/setup").send({
      fullName: "First Admin",
      email: "not-an-email",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EMAIL");
  });

  it("rejects a missing full name", async () => {
    const res = await request(app).post("/api/auth/setup").send({
      fullName: "A",
      email: "first@example.com",
      password: "secret123",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_FULL_NAME");
  });
});

describe("GET /api/auth/me", () => {
  it("returns the verified caller's identity", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      uid: "manager-1",
      email: "manager-1@example.com",
      role: "manager",
    });
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });
});
