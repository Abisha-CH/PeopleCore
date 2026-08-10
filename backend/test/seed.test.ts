import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
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

// ---- helpers ---------------------------------------------------------------

async function seed() {
  return request(app)
    .post("/api/seed")
    .set("Authorization", `Bearer ${adminToken}`);
}

// ---- POST /api/seed --------------------------------------------------------

describe("POST /api/seed", () => {
  describe("initial seed", () => {
    it("returns 201 and creates all three leave types", async () => {
      const res = await seed();
      expect(res.status).toBe(201);
      expect(res.body.created.leaveTypes).toBe(3);

      const snap = await db.collection("leaveTypes").get();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      expect(docs).toHaveLength(3);

      const annual = docs.find((d) => d.id === "annual");
      expect(annual).toMatchObject({
        name: "Annual",
        isCapped: true,
        defaultDaysPerYear: 14,
      });

      const medical = docs.find((d) => d.id === "medical");
      expect(medical).toMatchObject({
        name: "Medical",
        isCapped: true,
        defaultDaysPerYear: 14,
      });

      const unpaid = docs.find((d) => d.id === "unpaid");
      expect(unpaid).toMatchObject({
        name: "Unpaid",
        isCapped: false,
        defaultDaysPerYear: 0,
      });
    });

    it("creates LeaveEntitlement documents for capped types only", async () => {
      const res = await seed();
      expect(res.status).toBe(201);
      expect(res.body.created.leaveEntitlements).toBe(2);

      const snap = await db.collection("leaveEntitlements").get();
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      expect(docs).toHaveLength(2);

      const annualEnt = docs.find((d) => d.id === "annual");
      expect(annualEnt).toMatchObject({
        leaveTypeId: "annual",
        daysPerYear: 14,
      });

      const medicalEnt = docs.find((d) => d.id === "medical");
      expect(medicalEnt).toMatchObject({
        leaveTypeId: "medical",
        daysPerYear: 14,
      });
    });

    it("does not create a LeaveEntitlement for Unpaid", async () => {
      await seed();

      const snap = await db.collection("leaveEntitlements").get();
      const docs = snap.docs.map((d) => d.id);
      expect(docs).not.toContain("unpaid");
    });
  });

  describe("idempotency", () => {
    it("returns 200 with zero counts on second run", async () => {
      await seed();
      const res = await seed();

      expect(res.status).toBe(200);
      expect(res.body.created.leaveTypes).toBe(0);
      expect(res.body.created.leaveEntitlements).toBe(0);
      expect(res.body.message).toBe("Seed data already exists.");
    });

    it("does not create duplicate documents on re-run", async () => {
      await seed();
      await seed();

      const ltSnap = await db.collection("leaveTypes").get();
      expect(ltSnap.docs).toHaveLength(3);

      const entSnap = await db.collection("leaveEntitlements").get();
      expect(entSnap.docs).toHaveLength(2);
    });
  });

  describe("partial seed", () => {
    it("creates only the missing leave types and entitlements", async () => {
      // Manually seed only Annual leave type
      await db.collection("leaveTypes").doc("annual").set({
        name: "Annual",
        isCapped: true,
        defaultDaysPerYear: 14,
      });

      const res = await seed();
      expect(res.status).toBe(201);
      expect(res.body.created.leaveTypes).toBe(2); // Medical + Unpaid
      expect(res.body.created.leaveEntitlements).toBe(2); // Annual + Medical

      const ltSnap = await db.collection("leaveTypes").get();
      expect(ltSnap.docs).toHaveLength(3);

      const entSnap = await db.collection("leaveEntitlements").get();
      expect(entSnap.docs).toHaveLength(2);
    });
  });

  describe("audit logging", () => {
    it("writes audit entries for each created leave type", async () => {
      await seed();

      const auditRes = await request(app)
        .get("/api/audit-log")
        .set("Authorization", `Bearer ${adminToken}`);

      const ltEntries = auditRes.body.entries.filter(
        (e: { action: string }) => e.action === "seed.create_leave_type",
      );
      expect(ltEntries).toHaveLength(3);

      for (const entry of ltEntries) {
        expect(entry).toMatchObject({
          actorId: "admin-1",
          actorRole: "admin",
          targetType: "LeaveType",
        });
        expect(entry.targetId).toEqual(expect.any(String));
      }
    });

    it("writes audit entries for each created entitlement", async () => {
      await seed();

      const auditRes = await request(app)
        .get("/api/audit-log")
        .set("Authorization", `Bearer ${adminToken}`);

      const entEntries = auditRes.body.entries.filter(
        (e: { action: string }) => e.action === "seed.create_leave_entitlement",
      );
      expect(entEntries).toHaveLength(2);

      for (const entry of entEntries) {
        expect(entry).toMatchObject({
          actorId: "admin-1",
          actorRole: "admin",
          targetType: "LeaveEntitlement",
        });
        expect(entry.targetId).toEqual(expect.any(String));
      }
    });

    it("does not write audit entries when seed data already exists", async () => {
      await seed();
      await seed();

      const auditRes = await request(app)
        .get("/api/audit-log")
        .set("Authorization", `Bearer ${adminToken}`);

      const seedEntries = auditRes.body.entries.filter(
        (e: { action: string }) => e.action.startsWith("seed."),
      );
      expect(seedEntries).toHaveLength(5); // 3 leave types + 2 entitlements from first run only
    });
  });

  describe("access control", () => {
    it("returns 401 without a token", async () => {
      const res = await request(app).post("/api/seed");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    it("returns 403 for a manager", async () => {
      const res = await request(app)
        .post("/api/seed")
        .set("Authorization", `Bearer ${managerToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for an employee", async () => {
      const res = await request(app)
        .post("/api/seed")
        .set("Authorization", `Bearer ${employeeToken}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });
  });
});
