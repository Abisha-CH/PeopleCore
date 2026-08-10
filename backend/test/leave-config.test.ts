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

async function seedLeaveType(
  id: string,
  name: string,
  isCapped: boolean,
  defaultDaysPerYear: number,
) {
  await db.collection("leaveTypes").doc(id).set({
    name,
    isCapped,
    defaultDaysPerYear,
  });
}

async function seedEmployee(id: string) {
  await db.collection("employees").doc(id).set({
    employeeId: id,
    fullName: "Alice Adeyemi",
    email: `${id}@example.com`,
    phone: "+234-800-000-0001",
    department: "Engineering",
    jobTitle: "Software Engineer",
    employmentRole: "full-time",
    startDate: "2024-01-15",
    status: "active",
    nationalId: `NID-${id}`,
    address: "12 Main Street, Lagos",
  });
}

async function seedEntitlement(leaveTypeId: string, daysPerYear: number) {
  await db
    .collection("leaveEntitlements")
    .doc(leaveTypeId)
    .set({ leaveTypeId, daysPerYear });
}

async function seedOverride(
  employeeId: string,
  leaveTypeId: string,
  daysPerYear: number,
) {
  await db
    .collection("employeeLeaveEntitlements")
    .doc(`${employeeId}_${leaveTypeId}`)
    .set({ employeeId, leaveTypeId, daysPerYear });
}

async function auditEntries(action: string) {
  const res = await request(app)
    .get("/api/audit-log")
    .set("Authorization", `Bearer ${adminToken}`);
  expect(res.status).toBe(200);
  return res.body.entries.filter(
    (e: { action: string }) => e.action === action,
  );
}

function authed(
  req: request.Test,
  token: string = adminToken,
): request.Test {
  return req.set("Authorization", `Bearer ${token}`);
}

// ============================================================================
// Leave Types
// ============================================================================

describe("Leave Types — /api/leave-types", () => {
  // ---- POST ----------------------------------------------------------------

  describe("POST /", () => {
    it("creates a capped leave type", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "Sick Leave",
        isCapped: true,
        defaultDaysPerYear: 10,
      });

      expect(res.status).toBe(201);
      expect(res.body.leaveType).toMatchObject({
        name: "Sick Leave",
        isCapped: true,
        defaultDaysPerYear: 10,
      });
      expect(res.body.leaveType.leaveTypeId).toEqual(expect.any(String));

      const doc = await db
        .collection("leaveTypes")
        .doc(res.body.leaveType.leaveTypeId)
        .get();
      expect(doc.exists).toBe(true);
    });

    it("forces defaultDaysPerYear to 0 for an uncapped leave type", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "Unpaid",
        isCapped: false,
        defaultDaysPerYear: 20,
      });

      expect(res.status).toBe(201);
      expect(res.body.leaveType.defaultDaysPerYear).toBe(0);
    });

    it("returns 409 for a duplicate name (case-insensitive)", async () => {
      await authed(request(app).post("/api/leave-types")).send({
        name: "Sick Leave",
        isCapped: true,
        defaultDaysPerYear: 10,
      });

      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "sick leave",
        isCapped: true,
        defaultDaysPerYear: 12,
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_NAME");
    });

    it("returns 400 when name is missing", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        isCapped: true,
        defaultDaysPerYear: 10,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_NAME");
    });

    it("returns 400 when isCapped is not a boolean", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "Sick",
        isCapped: "yes",
        defaultDaysPerYear: 10,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_IS_CAPPED");
    });

    it("returns 400 when a capped type has no positive defaultDaysPerYear", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "Sick",
        isCapped: true,
        defaultDaysPerYear: 0,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DEFAULT_DAYS");
    });

    it("writes a leave_type.create audit entry", async () => {
      const res = await authed(request(app).post("/api/leave-types")).send({
        name: "Sick Leave",
        isCapped: true,
        defaultDaysPerYear: 10,
      });
      expect(res.status).toBe(201);

      const entries = await auditEntries("leave_type.create");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: "admin-1",
        actorRole: "admin",
        targetType: "LeaveType",
        targetId: res.body.leaveType.leaveTypeId,
      });
    });
  });

  // ---- GET / ---------------------------------------------------------------

  describe("GET /", () => {
    it("lists leave types sorted by name", async () => {
      await seedLeaveType("zebra", "Zebra Leave", true, 5);
      await seedLeaveType("annual", "Annual", true, 14);
      await seedLeaveType("unpaid", "Unpaid", false, 0);

      const res = await authed(request(app).get("/api/leave-types"));

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.leaveTypes.map((t: { name: string }) => t.name)).toEqual([
        "Annual",
        "Unpaid",
        "Zebra Leave",
      ]);
    });
  });

  // ---- GET /:id ------------------------------------------------------------

  describe("GET /:id", () => {
    it("returns a single leave type", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(request(app).get("/api/leave-types/annual"));

      expect(res.status).toBe(200);
      expect(res.body.leaveType).toMatchObject({
        leaveTypeId: "annual",
        name: "Annual",
        isCapped: true,
        defaultDaysPerYear: 14,
      });
    });

    it("returns 404 for a missing leave type", async () => {
      const res = await authed(request(app).get("/api/leave-types/nope"));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ---- PUT /:id ------------------------------------------------------------

  describe("PUT /:id", () => {
    it("updates a leave type and writes a diff audit entry", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(request(app).put("/api/leave-types/annual")).send({
        name: "Annual Leave",
        isCapped: true,
        defaultDaysPerYear: 15,
      });

      expect(res.status).toBe(200);
      expect(res.body.leaveType).toMatchObject({
        name: "Annual Leave",
        isCapped: true,
        defaultDaysPerYear: 15,
      });

      const entries = await auditEntries("leave_type.update");
      expect(entries).toHaveLength(1);
      expect(entries[0].diff).toEqual({
        name: { before: "Annual", after: "Annual Leave" },
        defaultDaysPerYear: { before: 14, after: 15 },
      });
    });

    it("returns 409 when updating to a duplicate name", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedLeaveType("medical", "Medical", true, 14);

      const res = await authed(request(app).put("/api/leave-types/annual")).send({
        name: "medical",
        isCapped: true,
        defaultDaysPerYear: 14,
      });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_NAME");
    });

    it("returns 404 for a missing leave type", async () => {
      const res = await authed(request(app).put("/api/leave-types/nope")).send({
        name: "X",
        isCapped: true,
        defaultDaysPerYear: 14,
      });
      expect(res.status).toBe(404);
    });

    it("cascades removal of entitlement and overrides when a capped type becomes uncapped", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);
      await seedOverride("emp-1", "annual", 20);

      const res = await authed(request(app).put("/api/leave-types/annual")).send({
        name: "Annual",
        isCapped: false,
        defaultDaysPerYear: 0,
      });
      expect(res.status).toBe(200);

      const entDoc = await db.collection("leaveEntitlements").doc("annual").get();
      expect(entDoc.exists).toBe(false);

      const overrideSnap = await db.collection("employeeLeaveEntitlements").get();
      expect(overrideSnap.docs).toHaveLength(0);
    });

    it("does not cascade when the type stays capped", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);

      const res = await authed(request(app).put("/api/leave-types/annual")).send({
        name: "Annual Leave",
        isCapped: true,
        defaultDaysPerYear: 14,
      });
      expect(res.status).toBe(200);

      const entDoc = await db.collection("leaveEntitlements").doc("annual").get();
      expect(entDoc.exists).toBe(true);
    });
  });

  // ---- DELETE /:id ---------------------------------------------------------

  describe("DELETE /:id", () => {
    it("deletes the leave type and cascades entitlement + overrides", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);
      await seedOverride("emp-1", "annual", 20);
      await seedOverride("emp-2", "annual", 10);

      const res = await authed(request(app).delete("/api/leave-types/annual"));
      expect(res.status).toBe(200);
      expect(res.body.leaveType.leaveTypeId).toBe("annual");

      const ltDoc = await db.collection("leaveTypes").doc("annual").get();
      expect(ltDoc.exists).toBe(false);

      const entDoc = await db.collection("leaveEntitlements").doc("annual").get();
      expect(entDoc.exists).toBe(false);

      const overrideSnap = await db.collection("employeeLeaveEntitlements").get();
      expect(overrideSnap.docs).toHaveLength(0);
    });

    it("writes audit entries for the delete and the cascades", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);
      await seedOverride("emp-1", "annual", 20);

      const res = await authed(request(app).delete("/api/leave-types/annual"));
      expect(res.status).toBe(200);

      expect(await auditEntries("leave_type.delete")).toHaveLength(1);
      expect(await auditEntries("leave_entitlement.delete")).toHaveLength(1);
      expect(
        await auditEntries("employee_leave_entitlement.delete"),
      ).toHaveLength(1);
    });

    it("returns 404 for a missing leave type", async () => {
      const res = await authed(request(app).delete("/api/leave-types/nope"));
      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// Leave Entitlements (company-wide)
// ============================================================================

describe("Leave Entitlements — /api/leave-entitlements", () => {
  // ---- PUT /:leaveTypeId ---------------------------------------------------

  describe("PUT /:leaveTypeId", () => {
    it("creates an entitlement for a capped leave type", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).put("/api/leave-entitlements/annual"),
      ).send({ daysPerYear: 18 });

      expect(res.status).toBe(201);
      expect(res.body.entitlement).toEqual({
        leaveTypeId: "annual",
        daysPerYear: 18,
      });

      const entries = await auditEntries("leave_entitlement.create");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "LeaveEntitlement",
        targetId: "annual",
      });
    });

    it("updates an existing entitlement", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);

      const res = await authed(
        request(app).put("/api/leave-entitlements/annual"),
      ).send({ daysPerYear: 20 });

      expect(res.status).toBe(200);
      expect(res.body.entitlement.daysPerYear).toBe(20);

      const entries = await auditEntries("leave_entitlement.update");
      expect(entries).toHaveLength(1);
      expect(entries[0].diff.daysPerYear).toEqual({
        before: 14,
        after: 20,
      });
    });

    it("returns 400 for an uncapped leave type", async () => {
      await seedLeaveType("unpaid", "Unpaid", false, 0);

      const res = await authed(
        request(app).put("/api/leave-entitlements/unpaid"),
      ).send({ daysPerYear: 10 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("UNCAPPED_LEAVE_TYPE");
    });

    it("returns 404 for a missing leave type", async () => {
      const res = await authed(
        request(app).put("/api/leave-entitlements/nope"),
      ).send({ daysPerYear: 10 });
      expect(res.status).toBe(404);
    });

    it("returns 400 for an invalid daysPerYear", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).put("/api/leave-entitlements/annual"),
      ).send({ daysPerYear: 0 });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DAYS_PER_YEAR");
    });
  });

  // ---- GET /:leaveTypeId ---------------------------------------------------

  describe("GET /:leaveTypeId", () => {
    it("returns the entitlement for a configured leave type", async () => {
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 14);

      const res = await authed(
        request(app).get("/api/leave-entitlements/annual"),
      );
      expect(res.status).toBe(200);
      expect(res.body.entitlement).toEqual({
        leaveTypeId: "annual",
        daysPerYear: 14,
      });
    });

    it("returns 404 when no entitlement is configured for the leave type", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).get("/api/leave-entitlements/annual"),
      );
      expect(res.status).toBe(404);
    });

    it("returns 404 when the leave type does not exist", async () => {
      const res = await authed(
        request(app).get("/api/leave-entitlements/nope"),
      );
      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// Employee Leave Entitlements (overrides)
// ============================================================================

describe("Employee Leave Entitlements — /api/employee-leave-entitlements", () => {
  describe("POST /", () => {
    it("creates an override for an existing employee and capped leave type", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual", daysPerYear: 25 });

      expect(res.status).toBe(201);
      expect(res.body.override).toEqual({
        employeeId: "emp-1",
        leaveTypeId: "annual",
        daysPerYear: 25,
      });

      const doc = await db
        .collection("employeeLeaveEntitlements")
        .doc("emp-1_annual")
        .get();
      expect(doc.exists).toBe(true);
      expect(doc.data()?.daysPerYear).toBe(25);

      const entries = await auditEntries("employee_leave_entitlement.create");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "EmployeeLeaveEntitlement",
        targetId: "emp-1_annual",
      });
    });

    it("returns 409 for a duplicate override", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);
      await seedOverride("emp-1", "annual", 25);

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual", daysPerYear: 30 });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_OVERRIDE");
    });

    it("returns 404 when the employee does not exist", async () => {
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "nobody", leaveTypeId: "annual", daysPerYear: 25 });

      expect(res.status).toBe(404);
    });

    it("returns 400 for an uncapped leave type", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("unpaid", "Unpaid", false, 0);

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "unpaid", daysPerYear: 25 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("UNCAPPED_LEAVE_TYPE");
    });

    it("returns 404 when the leave type does not exist", async () => {
      await seedEmployee("emp-1");

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "nope", daysPerYear: 25 });

      expect(res.status).toBe(404);
    });

    it("returns 400 for an invalid payload", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).post("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DAYS_PER_YEAR");
    });
  });

  describe("GET /", () => {
    it("lists overrides sorted by employee then leave type", async () => {
      await seedOverride("emp-2", "medical", 10);
      await seedOverride("emp-1", "annual", 25);

      const res = await authed(
        request(app).get("/api/employee-leave-entitlements"),
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.overrides[0]).toMatchObject({
        employeeId: "emp-1",
        leaveTypeId: "annual",
      });
      expect(res.body.overrides[1]).toMatchObject({
        employeeId: "emp-2",
        leaveTypeId: "medical",
      });
    });

    it("filters by employeeId and leaveTypeId", async () => {
      await seedOverride("emp-1", "annual", 25);
      await seedOverride("emp-1", "medical", 10);
      await seedOverride("emp-2", "annual", 30);

      const byEmployee = await authed(
        request(app).get("/api/employee-leave-entitlements?employeeId=emp-1"),
      );
      expect(byEmployee.body.total).toBe(2);

      const byType = await authed(
        request(app).get(
          "/api/employee-leave-entitlements?employeeId=emp-1&leaveTypeId=annual",
        ),
      );
      expect(byType.body.total).toBe(1);
      expect(byType.body.overrides[0].leaveTypeId).toBe("annual");
    });
  });

  describe("GET /:id", () => {
    it("returns a single override", async () => {
      await seedOverride("emp-1", "annual", 25);

      const res = await authed(
        request(app).get("/api/employee-leave-entitlements/emp-1_annual"),
      );
      expect(res.status).toBe(200);
      expect(res.body.override).toEqual({
        employeeId: "emp-1",
        leaveTypeId: "annual",
        daysPerYear: 25,
      });
    });

    it("returns 404 for a missing override", async () => {
      const res = await authed(
        request(app).get("/api/employee-leave-entitlements/emp-1_annual"),
      );
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /", () => {
    it("updates daysPerYear and writes a diff audit entry", async () => {
      await seedOverride("emp-1", "annual", 25);
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).put("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual", daysPerYear: 30 });

      expect(res.status).toBe(200);
      expect(res.body.override.daysPerYear).toBe(30);

      const entries = await auditEntries("employee_leave_entitlement.update");
      expect(entries).toHaveLength(1);
      expect(entries[0].diff.daysPerYear).toEqual({
        before: 25,
        after: 30,
      });
    });

    it("returns 404 when the override does not exist", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);

      const res = await authed(
        request(app).put("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual", daysPerYear: 30 });

      expect(res.status).toBe(404);
    });

    it("returns 400 when the leave type is no longer capped", async () => {
      await seedOverride("emp-1", "annual", 25);
      await seedLeaveType("annual", "Annual", false, 0);

      const res = await authed(
        request(app).put("/api/employee-leave-entitlements"),
      ).send({ employeeId: "emp-1", leaveTypeId: "annual", daysPerYear: 30 });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("UNCAPPED_LEAVE_TYPE");
    });
  });

  describe("DELETE /:id", () => {
    it("deletes an override and writes an audit entry", async () => {
      await seedOverride("emp-1", "annual", 25);

      const res = await authed(
        request(app).delete("/api/employee-leave-entitlements/emp-1_annual"),
      );
      expect(res.status).toBe(200);
      expect(res.body.override).toEqual({
        employeeId: "emp-1",
        leaveTypeId: "annual",
        daysPerYear: 25,
      });

      const doc = await db
        .collection("employeeLeaveEntitlements")
        .doc("emp-1_annual")
        .get();
      expect(doc.exists).toBe(false);

      const entries = await auditEntries("employee_leave_entitlement.delete");
      expect(entries).toHaveLength(1);
      expect(entries[0].targetId).toBe("emp-1_annual");
    });

    it("returns 404 for a missing override", async () => {
      const res = await authed(
        request(app).delete("/api/employee-leave-entitlements/emp-1_annual"),
      );
      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// Public Holidays
// ============================================================================

describe("Public Holidays — /api/public-holidays", () => {
  describe("POST /", () => {
    it("creates a public holiday and derives the year from the date", async () => {
      const res = await authed(request(app).post("/api/public-holidays")).send({
        name: "New Year's Day",
        date: "2025-01-01",
      });

      expect(res.status).toBe(201);
      expect(res.body.publicHoliday).toMatchObject({
        name: "New Year's Day",
        date: "2025-01-01",
        year: 2025,
      });
      expect(res.body.publicHoliday.publicHolidayId).toEqual(expect.any(String));

      const entries = await auditEntries("public_holiday.create");
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "PublicHoliday",
        targetId: res.body.publicHoliday.publicHolidayId,
      });
    });

    it("returns 409 for a duplicate date", async () => {
      await authed(request(app).post("/api/public-holidays")).send({
        name: "New Year's Day",
        date: "2025-01-01",
      });

      const res = await authed(request(app).post("/api/public-holidays")).send({
        name: "Extra Holiday",
        date: "2025-01-01",
      });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("DUPLICATE_DATE");
    });

    it("returns 400 for an invalid date", async () => {
      const res = await authed(request(app).post("/api/public-holidays")).send({
        name: "Bad",
        date: "01/01/2025",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DATE");
    });

    it("returns 400 for a missing name", async () => {
      const res = await authed(request(app).post("/api/public-holidays")).send({
        date: "2025-01-01",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_NAME");
    });
  });

  describe("GET /", () => {
    it("lists holidays sorted by date", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });
      await db.collection("publicHolidays").doc("h2").set({
        name: "New Year's Day",
        date: "2025-01-01",
        year: 2025,
      });

      const res = await authed(request(app).get("/api/public-holidays"));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
      expect(res.body.publicHolidays[0].date).toBe("2025-01-01");
      expect(res.body.publicHolidays[1].date).toBe("2025-12-25");
    });

    it("filters by year", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Holiday 2024",
        date: "2024-06-01",
        year: 2024,
      });
      await db.collection("publicHolidays").doc("h2").set({
        name: "Holiday 2025",
        date: "2025-06-01",
        year: 2025,
      });

      const res = await authed(request(app).get("/api/public-holidays?year=2025"));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.publicHolidays[0].year).toBe(2025);
    });

    it("returns 400 for an invalid year", async () => {
      const res = await authed(
        request(app).get("/api/public-holidays?year=abc"),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_YEAR");
    });
  });

  describe("GET /:id", () => {
    it("returns a single holiday", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });

      const res = await authed(request(app).get("/api/public-holidays/h1"));
      expect(res.status).toBe(200);
      expect(res.body.publicHoliday).toEqual({
        publicHolidayId: "h1",
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });
    });

    it("returns 404 for a missing holiday", async () => {
      const res = await authed(request(app).get("/api/public-holidays/nope"));
      expect(res.status).toBe(404);
    });
  });

  describe("PUT /:id", () => {
    it("updates a holiday and re-derives the year", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });

      const res = await authed(request(app).put("/api/public-holidays/h1")).send({
        name: "Christmas Day",
        date: "2026-12-25",
      });

      expect(res.status).toBe(200);
      expect(res.body.publicHoliday).toMatchObject({
        publicHolidayId: "h1",
        name: "Christmas Day",
        date: "2026-12-25",
        year: 2026,
      });

      const entries = await auditEntries("public_holiday.update");
      expect(entries).toHaveLength(1);
      expect(entries[0].diff).toEqual({
        name: { before: "Christmas", after: "Christmas Day" },
        date: { before: "2025-12-25", after: "2026-12-25" },
        year: { before: 2025, after: 2026 },
      });
    });

    it("returns 409 when updating to a duplicate date (excluding self)", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });
      await db.collection("publicHolidays").doc("h2").set({
        name: "Boxing Day",
        date: "2025-12-26",
        year: 2025,
      });

      // Same date as self is fine
      const self = await authed(request(app).put("/api/public-holidays/h1")).send({
        name: "Christmas",
        date: "2025-12-25",
      });
      expect(self.status).toBe(200);

      // Same date as another holiday conflicts
      const conflict = await authed(request(app).put("/api/public-holidays/h1")).send({
        name: "Christmas",
        date: "2025-12-26",
      });
      expect(conflict.status).toBe(409);
      expect(conflict.body.error.code).toBe("DUPLICATE_DATE");
    });

    it("returns 404 for a missing holiday", async () => {
      const res = await authed(request(app).put("/api/public-holidays/nope")).send({
        name: "X",
        date: "2025-01-01",
      });
      expect(res.status).toBe(404);
    });
  });

  describe("DELETE /:id", () => {
    it("deletes a holiday and writes an audit entry", async () => {
      await db.collection("publicHolidays").doc("h1").set({
        name: "Christmas",
        date: "2025-12-25",
        year: 2025,
      });

      const res = await authed(request(app).delete("/api/public-holidays/h1"));
      expect(res.status).toBe(200);
      expect(res.body.publicHoliday.publicHolidayId).toBe("h1");

      const doc = await db.collection("publicHolidays").doc("h1").get();
      expect(doc.exists).toBe(false);

      const entries = await auditEntries("public_holiday.delete");
      expect(entries).toHaveLength(1);
      expect(entries[0].targetId).toBe("h1");
    });

    it("returns 404 for a missing holiday", async () => {
      const res = await authed(request(app).delete("/api/public-holidays/nope"));
      expect(res.status).toBe(404);
    });
  });
});

// ============================================================================
// Access control (shared across all four resources)
// ============================================================================

describe("Access control", () => {
  const writeRequests: Array<{ label: string; fn: () => request.Test }> = [
    { label: "create leave type", fn: () => request(app).post("/api/leave-types") },
    { label: "create entitlement", fn: () => request(app).put("/api/leave-entitlements/x") },
    { label: "create override", fn: () => request(app).post("/api/employee-leave-entitlements") },
    { label: "create public holiday", fn: () => request(app).post("/api/public-holidays") },
  ];

  const readRequests: Array<{ label: string; fn: () => request.Test }> = [
    { label: "list entitlements", fn: () => request(app).get("/api/leave-entitlements/x") },
    { label: "list overrides", fn: () => request(app).get("/api/employee-leave-entitlements") },
    { label: "list public holidays", fn: () => request(app).get("/api/public-holidays") },
  ];

  for (const { label, fn } of [...writeRequests, ...readRequests]) {
    it(`returns 401 without a token for ${label}`, async () => {
      const res = await fn().send({ name: "X", date: "2025-01-01", isCapped: true });
      expect(res.status).toBe(401);
    });

    it(`returns 403 for a manager on ${label}`, async () => {
      const res = await authed(fn(), managerToken).send({ name: "X", date: "2025-01-01", isCapped: true });
      expect(res.status).toBe(403);
    });

    it(`returns 403 for an employee on ${label}`, async () => {
      const res = await authed(fn(), employeeToken).send({ name: "X", date: "2025-01-01", isCapped: true });
      expect(res.status).toBe(403);
    });
  }

  // Leave types are readable by every authenticated user — employees and
  // managers need the list for leave-request forms and balance displays.
  // Only mutations (create/update/delete) remain admin-only (covered above).
  for (const { label, token } of [
    { label: "manager", token: managerToken },
    { label: "employee", token: employeeToken },
  ]) {
    it(`returns 200 for a ${label} on list leave types`, async () => {
      const res = await authed(request(app).get("/api/leave-types"), token);
      expect(res.status).toBe(200);
    });
  }
});
