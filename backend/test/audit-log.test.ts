import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () => await import("./helpers/firebase-mock"));

import { createApp } from "../src/app";
import { makeToken, resetMock, db } from "./helpers/firebase-mock";

const app = createApp();
const adminToken = makeToken("admin-1", "admin");
const managerToken = makeToken("manager-1", "manager");
const employeeToken = makeToken("employee-1", "employee");

beforeEach(() => {
  resetMock();
});

/** Seed an audit entry directly (simulating a prior write). */
async function seedAuditEntry(
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const ref = db.collection("auditLog").doc();
  await ref.set({
    actorId: "actor-1",
    actorRole: "employee",
    action: "test.action",
    targetType: "Employee",
    targetId: "target-1",
    timestamp: new Date(),
    ...overrides,
  });
  return ref.id;
}

// ---- GET /api/audit-log ----------------------------------------------------

describe("GET /api/audit-log", () => {
  it("returns 401 without a token", async () => {
    const res = await request(app).get("/api/audit-log");
    expect(res.status).toBe(401);
  });

  it("returns 403 for Line Manager", async () => {
    const res = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 403 for Employee", async () => {
    const res = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("returns entries ordered by timestamp descending", async () => {
    await seedAuditEntry({ targetId: "first", timestamp: new Date("2026-01-01") });
    await seedAuditEntry({ targetId: "second", timestamp: new Date("2026-06-01") });
    await seedAuditEntry({ targetId: "third", timestamp: new Date("2026-03-01") });

    const res = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(3);
    expect(res.body.entries[0].targetId).toBe("second");
    expect(res.body.entries[1].targetId).toBe("third");
    expect(res.body.entries[2].targetId).toBe("first");
  });

  it("entries contain all required fields", async () => {
    await seedAuditEntry();

    const res = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const entry = res.body.entries[0];
    expect(entry).toHaveProperty("auditLogId");
    expect(entry).toHaveProperty("actorId");
    expect(entry).toHaveProperty("actorRole");
    expect(entry).toHaveProperty("action");
    expect(entry).toHaveProperty("targetType");
    expect(entry).toHaveProperty("targetId");
    expect(entry).toHaveProperty("timestamp");
    // diff is omitted for create (not present), but the key should be absent/undefined
    expect(entry.auditLogId).toEqual(expect.any(String));
    expect(entry.actorId).toEqual(expect.any(String));
    expect(entry.timestamp).toEqual(expect.any(String));
  });

  it("filters by targetType", async () => {
    await seedAuditEntry({ targetType: "Employee" });
    await seedAuditEntry({ targetType: "LeaveRequest" });
    await seedAuditEntry({ targetType: "Employee" });

    const res = await request(app)
      .get("/api/audit-log?targetType=Employee")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(res.body.entries.every((e: { targetType: string }) => e.targetType === "Employee")).toBe(true);
  });

  it("filters by actorId", async () => {
    await seedAuditEntry({ actorId: "alice" });
    await seedAuditEntry({ actorId: "bob" });
    await seedAuditEntry({ actorId: "alice" });

    const res = await request(app)
      .get("/api/audit-log?actorId=alice")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
    expect(
      res.body.entries.every((e: { actorId: string }) => e.actorId === "alice"),
    ).toBe(true);
  });

  it("filters by date range (from and to)", async () => {
    await seedAuditEntry({ targetId: "early", timestamp: new Date("2026-01-15") });
    await seedAuditEntry({ targetId: "mid", timestamp: new Date("2026-06-15") });
    await seedAuditEntry({ targetId: "late", timestamp: new Date("2026-12-15") });

    const res = await request(app)
      .get("/api/audit-log?from=2026-03-01&to=2026-09-01")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0].targetId).toBe("mid");
  });

  it("respects the limit parameter", async () => {
    for (let i = 0; i < 5; i++) {
      await seedAuditEntry({ targetId: `item-${i}` });
    }

    const res = await request(app)
      .get("/api/audit-log?limit=2")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(2);
  });

  it("returns an empty list when no entries exist", async () => {
    const res = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(0);
    expect(res.body.total).toBe(0);
  });
});

// ---- GET /api/audit-log/:id ------------------------------------------------

describe("GET /api/audit-log/:id", () => {
  it("returns a single entry by ID", async () => {
    const id = await seedAuditEntry({ targetId: "specific" });

    const res = await request(app)
      .get(`/api/audit-log/${id}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.entry.auditLogId).toBe(id);
    expect(res.body.entry.targetId).toBe("specific");
  });

  it("returns 404 for a non-existent ID", async () => {
    const res = await request(app)
      .get("/api/audit-log/non-existent-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 for non-admin roles", async () => {
    const id = await seedAuditEntry();

    const resManager = await request(app)
      .get(`/api/audit-log/${id}`)
      .set("Authorization", `Bearer ${managerToken}`);
    expect(resManager.status).toBe(403);

    const resEmployee = await request(app)
      .get(`/api/audit-log/${id}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(resEmployee.status).toBe(403);
  });
});

// ---- Immutability ----------------------------------------------------------

describe("audit log immutability", () => {
  it("returns 404 for PUT on /api/audit-log/:id (no route defined)", async () => {
    const res = await request(app)
      .put("/api/audit-log/any-id")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ action: "hacked" });

    expect(res.status).toBe(404);
  });

  it("returns 404 for DELETE on /api/audit-log/:id (no route defined)", async () => {
    const res = await request(app)
      .delete("/api/audit-log/any-id")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});
