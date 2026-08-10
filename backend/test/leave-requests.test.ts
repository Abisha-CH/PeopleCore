import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () =>
  await import("./helpers/firebase-mock"),
);

import { createApp } from "../src/app";
import { makeToken, resetMock, db } from "./helpers/firebase-mock";

const app = createApp();

// ---- stable tokens (survive resetMock since tokenMap is not cleared) --------

const adminToken = makeToken("admin-1", "admin");
const empToken = makeToken("emp-1", "employee");
const mgrToken = makeToken("mgr-1", "manager");

// ---- seed helpers -----------------------------------------------------------

async function seedEmployee(
  id: string,
  overrides?: { fullName?: string; lineManagerId?: string },
) {
  const doc: Record<string, unknown> = {
    employeeId: id,
    fullName: overrides?.fullName ?? "Test Employee",
    email: `${id}@example.com`,
    phone: "+234-800-000-0001",
    department: "Engineering",
    jobTitle: "Engineer",
    employmentRole: "full-time",
    startDate: "2024-01-15",
    status: "active",
    nationalId: `NID-${id}`,
    address: "12 Main Street",
  };
  if (overrides?.lineManagerId) doc.lineManagerId = overrides.lineManagerId;
  await db.collection("employees").doc(id).set(doc);
}

async function seedLeaveType(
  id: string,
  name: string,
  isCapped: boolean,
  defaultDaysPerYear: number,
) {
  await db.collection("leaveTypes").doc(id).set({ name, isCapped, defaultDaysPerYear });
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

async function seedHoliday(id: string, name: string, date: string) {
  await db
    .collection("publicHolidays")
    .doc(id)
    .set({ name, date, year: Number(date.slice(0, 4)) });
}

async function seedLeaveRequest(
  docId: string,
  data: Record<string, unknown>,
) {
  await db.collection("leaveRequests").doc(docId).set(data);
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

function authed(req: request.Test, token: string = adminToken): request.Test {
  return req.set("Authorization", `Bearer ${token}`);
}

async function setupAnnualLeaveForEmp1() {
  await seedEmployee("emp-1", { fullName: "Alice" });
  await seedLeaveType("annual", "Annual", true, 14);
  await seedEntitlement("annual", 14);
}

// Reset the in-memory Firestore between every test.  Tokens survive (tokenMap
// is not cleared by resetMock), so the module-level tokens above stay valid.
beforeEach(() => {
  resetMock();
});

// ============================================================================
// Leave Requests — POST, GET /, GET /:id
// ============================================================================

describe("Leave Requests — /api/leave-requests", () => {
  // ==========================================================================
  // POST /
  // ==========================================================================

  describe("POST /", () => {
    // ---- successful submissions --------------------------------------------

    it("creates a full-day request with status pending", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "Holiday",
        });

      expect(res.status).toBe(201);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("pending");
      expect(lr.employeeId).toBe("emp-1");
      expect(lr.leaveTypeId).toBe("annual");
      expect(lr.startDate).toBe("2026-08-10");
      expect(lr.endDate).toBe("2026-08-14");
      expect(lr.reason).toBe("Holiday");
      expect(lr.isHalfDay).toBe(false);
      expect(typeof lr.leaveRequestId).toBe("string");
    });

    it("computes numberOfDays as raw weekday count (no public holidays in range)", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10", // Mon
          endDate: "2026-08-14",   // Fri
          reason: "Vacation",
        });

      expect(res.status).toBe(201);
      // Mon–Fri = 5 weekdays, no holidays
      expect(res.body.leaveRequest.numberOfDays).toBe(5);
    });

    it("excludes weekends from numberOfDays", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-07", // Fri
          endDate: "2026-08-14",   // Fri
          reason: "Long weekend",
        });

      expect(res.status).toBe(201);
      // Fri(7) + Mon(10)–Fri(14) = 6 weekdays
      expect(res.body.leaveRequest.numberOfDays).toBe(6);
    });

    it("reduces numberOfDays by one for each public holiday on a weekday in range", async () => {
      await setupAnnualLeaveForEmp1();
      // Seed a holiday on Wed 2026-08-12 (weekday)
      await seedHoliday("h1", "Company Day", "2026-08-12");

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10", // Mon
          endDate: "2026-08-14",   // Fri
          reason: "Vacation",
        });

      expect(res.status).toBe(201);
      // 5 weekdays minus 1 holiday = 4
      expect(res.body.leaveRequest.numberOfDays).toBe(4);
    });

    it("does not reduce numberOfDays for a public holiday on a weekend", async () => {
      await setupAnnualLeaveForEmp1();
      // 2026-08-08 is a Saturday
      await seedHoliday("h1", "Sat Holiday", "2026-08-08");

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10", // Mon
          endDate: "2026-08-14",   // Fri
          reason: "Vacation",
        });

      expect(res.status).toBe(201);
      // 5 weekdays, holiday on Saturday excluded from count
      expect(res.body.leaveRequest.numberOfDays).toBe(5);
    });

    it("creates a half-day request with numberOfDays = 0.5", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-10",
          isHalfDay: true,
          halfDayPeriod: "morning",
          reason: "Doctor appointment",
        });

      expect(res.status).toBe(201);
      const lr = res.body.leaveRequest;
      expect(lr.isHalfDay).toBe(true);
      expect(lr.halfDayPeriod).toBe("morning");
      expect(lr.numberOfDays).toBe(0.5);
    });

    it("allows uncapped leave type without any entitlement document", async () => {
      await seedEmployee("emp-1", { fullName: "Alice" });
      await seedLeaveType("unpaid", "Unpaid", false, 0);

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "unpaid",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "Personal",
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.leaveTypeId).toBe("unpaid");
      expect(res.body.leaveRequest.numberOfDays).toBe(5);
    });

    // ---- validation (400) ---------------------------------------------------

    it("returns 400 when leaveTypeId is missing", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({ startDate: "2026-08-10", endDate: "2026-08-14", reason: "X" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_LEAVE_TYPE_ID");
    });

    it("returns 400 when leaveTypeId does not exist", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "nonexistent",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_LEAVE_TYPE_ID");
    });

    it("returns 400 when startDate is after endDate", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-14",
          endDate: "2026-08-10",
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DATE_RANGE");
    });

    it("returns 400 when startDate is invalid format", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "not-a-date",
          endDate: "2026-08-14",
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DATE");
    });

    it("returns 400 when reason is missing", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_REASON");
    });

    it("returns 400 when half-day startDate differs from endDate", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-11",
          isHalfDay: true,
          halfDayPeriod: "afternoon",
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("HALF_DAY_DATE_MISMATCH");
    });

    it("returns 400 when isHalfDay is true but halfDayPeriod is missing", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-10",
          isHalfDay: true,
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_HALF_DAY_PERIOD");
    });

    // ---- entitlement / balance ----------------------------------------------

    it("returns 400 when capped leave type has no entitlement configured", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);
      // No entitlement seeded.
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "X",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("NO_ENTITLEMENT");
    });

    it("returns 400 when the request would exceed the leave balance", async () => {
      await setupAnnualLeaveForEmp1();
      // Pre-seed an approved request consuming 13 days.
      await seedLeaveRequest("existing-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-07-01",
        endDate: "2026-07-17",
        isHalfDay: false,
        numberOfDays: 13,
        reason: "Previous trip",
        status: "approved",
        submittedAt: new Date(),
      });

      // Try to add 2 more days → 13 + 2 = 15 > 14 entitlement.
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-11",
          reason: "Extra days",
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("BALANCE_EXCEEDED");
    });

    it("allows request that exactly uses remaining balance", async () => {
      await setupAnnualLeaveForEmp1();
      await seedLeaveRequest("existing-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-07-01",
        endDate: "2026-07-17",
        isHalfDay: false,
        numberOfDays: 13,
        reason: "Previous trip",
        status: "approved",
        submittedAt: new Date(),
      });

      // 13 + 1 = 14 — exactly the entitlement.
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-10",
          reason: "Last day",
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.numberOfDays).toBe(1);
    });

    it("uses per-employee override entitlement over company-wide default", async () => {
      await seedEmployee("emp-1", { fullName: "Alice" });
      await seedLeaveType("annual", "Annual", true, 14);
      await seedEntitlement("annual", 5); // company-wide 5
      await seedOverride("emp-1", "annual", 20); // override 20

      // Request for 15 weekdays (3 full weeks) — would fail with company
      // default (5) but passes with override (20).
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-28",
          reason: "Extended leave",
        });

      expect(res.status).toBe(201);
      expect(res.body.leaveRequest.numberOfDays).toBe(15);
    });

    // ---- overlap detection --------------------------------------------------

    it("returns 409 when request overlaps an existing active request", async () => {
      await setupAnnualLeaveForEmp1();
      await seedLeaveRequest("existing-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Trip",
        status: "approved",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-13", // overlaps Aug 13–14 of existing
          endDate: "2026-08-17",
          reason: "Overlap",
        });

      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("OVERLAPPING_REQUEST");
    });

    it("allows request for non-overlapping consecutive date ranges", async () => {
      await setupAnnualLeaveForEmp1();
      await seedLeaveRequest("existing-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Trip",
        status: "approved",
        submittedAt: new Date(),
      });

      // Aug 17 starts after Aug 14 ends — no overlap.
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-17",
          endDate: "2026-08-21",
          reason: "More vacation",
        });

      expect(res.status).toBe(201);
    });

    it("allows request when the only overlapping request is cancelled", async () => {
      await setupAnnualLeaveForEmp1();
      await seedLeaveRequest("cancelled-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Cancelled trip",
        status: "cancelled",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "New trip",
        });

      expect(res.status).toBe(201);
    });

    it("allows request when the only overlapping request is rejected", async () => {
      await setupAnnualLeaveForEmp1();
      await seedLeaveRequest("rejected-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Rejected trip",
        status: "rejected",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "Retry",
        });

      expect(res.status).toBe(201);
    });

    // ---- auth --------------------------------------------------------------

    it("returns 401 when no token is provided", async () => {
      const res = await request(app)
        .post("/api/leave-requests")
        .send({ leaveTypeId: "annual", startDate: "2026-08-10", endDate: "2026-08-14", reason: "X" });

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    // ---- audit -------------------------------------------------------------

    it("writes a leave_request.create audit entry on successful creation", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "Audit test",
        });
      expect(res.status).toBe(201);

      const entries = await auditEntries("leave_request.create");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) =>
          e.targetId === res.body.leaveRequest.leaveRequestId,
      );
      expect(entry).toBeDefined();
      expect(entry.targetType).toBe("LeaveRequest");
      expect(entry.actorId).toBe("emp-1");
      expect(entry.actorRole).toBe("employee");
    });

    it("records submittedAt as a timestamp", async () => {
      await setupAnnualLeaveForEmp1();
      const res = await authed(request(app).post("/api/leave-requests"), empToken)
        .send({
          leaveTypeId: "annual",
          startDate: "2026-08-10",
          endDate: "2026-08-14",
          reason: "Timestamp test",
        });
      expect(res.status).toBe(201);
      expect(typeof res.body.leaveRequest.submittedAt).toBe("string");
    });
  });

  // ==========================================================================
  // GET /
  // ==========================================================================

  describe("GET /", () => {
    beforeEach(async () => {
      // Shared employee/manager directory for listing tests.
      await seedEmployee("admin-1", { fullName: "Admin One" });
      await seedEmployee("emp-1", {
        fullName: "Alice",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-2", {
        fullName: "Bob",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("mgr-1", { fullName: "Manager One" });
      await seedEmployee("emp-3", { fullName: "Charlie" }); // no manager
    });

    it("HR Admin sees all leave requests", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "A",
        status: "pending",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r2", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        startDate: "2026-08-17",
        endDate: "2026-08-21",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "B",
        status: "approved",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r3", {
        employeeId: "emp-3",
        leaveTypeId: "annual",
        startDate: "2026-09-01",
        endDate: "2026-09-04",
        isHalfDay: false,
        numberOfDays: 4,
        reason: "C",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).get("/api/leave-requests"), adminToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(3);
      expect(res.body.leaveRequests).toHaveLength(3);
    });

    it("Employee sees only their own leave requests", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "A",
        status: "pending",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r2", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        startDate: "2026-08-17",
        endDate: "2026-08-21",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "B",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).get("/api/leave-requests"), empToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.leaveRequests[0].employeeId).toBe("emp-1");
    });

    it("Line Manager sees only requests from their direct reports", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Direct report",
        status: "pending",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r2", {
        employeeId: "emp-3",
        leaveTypeId: "annual",
        startDate: "2026-08-17",
        endDate: "2026-08-21",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Non-report",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(request(app).get("/api/leave-requests"), mgrToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.leaveRequests[0].employeeId).toBe("emp-1");
    });

    it("returns empty list when employee has no requests", async () => {
      const res = await authed(request(app).get("/api/leave-requests"), empToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(0);
      expect(res.body.leaveRequests).toEqual([]);
    });

    it("filters by status when status query param is provided", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "A",
        status: "pending",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r2", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-17",
        endDate: "2026-08-21",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "B",
        status: "approved",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests?status=approved"),
        adminToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.leaveRequests[0].status).toBe("approved");
    });

    it("filters by leaveTypeId when leaveTypeId query param is provided", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "A",
        status: "pending",
        submittedAt: new Date(),
      });
      await seedLeaveRequest("r2", {
        employeeId: "emp-1",
        leaveTypeId: "medical",
        startDate: "2026-08-17",
        endDate: "2026-08-17",
        isHalfDay: false,
        numberOfDays: 1,
        reason: "B",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests?leaveTypeId=annual"),
        adminToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.leaveRequests[0].leaveTypeId).toBe("annual");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/leave-requests");
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // GET /:id
  // ==========================================================================

  describe("GET /:id", () => {
    beforeEach(async () => {
      await seedEmployee("emp-1", {
        fullName: "Alice",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-2", {
        fullName: "Bob",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("mgr-1", { fullName: "Manager One" });
      await seedEmployee("emp-3", { fullName: "Charlie" }); // no manager
    });

    it("HR Admin can view any leave request", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests/r1"),
        adminToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.leaveRequestId).toBe("r1");
      expect(res.body.leaveRequest.employeeId).toBe("emp-1");
    });

    it("Employee can view their own leave request", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests/r1"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.leaveRequestId).toBe("r1");
    });

    it("Employee cannot view another employee's leave request", async () => {
      await seedLeaveRequest("r2", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Bob's vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests/r2"),
        empToken,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("Line Manager can view a direct report's leave request", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests/r1"),
        mgrToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.leaveRequestId).toBe("r1");
    });

    it("Line Manager cannot view a non-report's leave request", async () => {
      await seedLeaveRequest("r3", {
        employeeId: "emp-3",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Charlie's vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).get("/api/leave-requests/r3"),
        mgrToken,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when leave request does not exist", async () => {
      const res = await authed(
        request(app).get("/api/leave-requests/nonexistent"),
        adminToken,
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).get("/api/leave-requests/r1");
      expect(res.status).toBe(401);
    });
  });

  // ==========================================================================
  // PATCH /:id/status — Line Manager first-stage approval
  // ==========================================================================

  describe("PATCH /:id/status", () => {
    beforeEach(async () => {
      await seedEmployee("emp-1", {
        fullName: "Alice",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-2", {
        fullName: "Bob",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-3", { fullName: "Charlie" });
      await seedEmployee("mgr-1", { fullName: "Manager One" });
    });

    it("approves a direct report's pending request to manager_approved", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("manager_approved");
      expect(lr.managerId).toBe("mgr-1");
      expect(typeof lr.managerActionAt).toBe("string");
    });

    it("rejects a direct report's pending request with the manager's reason", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({
        status: "rejected",
        managerRejectionReason: "Insufficient coverage",
      });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("rejected");
      expect(lr.managerId).toBe("mgr-1");
      expect(typeof lr.managerActionAt).toBe("string");
      expect(lr.managerRejectionReason).toBe("Insufficient coverage");
    });

    it("returns 403 when the request is from a non-direct report", async () => {
      await seedLeaveRequest("r3", {
        employeeId: "emp-3",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Charlie's vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r3/status"),
        mgrToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 400 when the request is not pending", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Already approved",
        status: "approved",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("returns 400 when rejecting without a managerRejectionReason", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "rejected" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_MANAGER_REJECTION_REASON");
    });

    it("returns 400 for an invalid target status", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 403 when an Employee acts on another employee's request", async () => {
      await seedLeaveRequest("r2", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Bob's vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r2/status"),
        empToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when the leave request does not exist", async () => {
      const res = await authed(
        request(app).patch("/api/leave-requests/nonexistent/status"),
        mgrToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app)
        .patch("/api/leave-requests/r1/status")
        .send({ status: "manager_approved" });

      expect(res.status).toBe(401);
    });

    it("writes a leave_request.manager_approve audit entry", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "manager_approved" });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.manager_approve");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe("mgr-1");
      expect(entry.actorRole).toBe("manager");
      expect(entry.targetType).toBe("LeaveRequest");
      expect(entry.diff).toEqual({
        status: { before: "pending", after: "manager_approved" },
      });
    });

    it("writes a leave_request.manager_reject audit entry", async () => {
      await seedLeaveRequest("r1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({
        status: "rejected",
        managerRejectionReason: "Not enough notice",
      });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.manager_reject");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.diff).toEqual({
        status: { before: "pending", after: "rejected" },
      });
    });
  });

  // ==========================================================================
  // PATCH /:id/status — HR Admin final approval (Ticket 08)
  // ==========================================================================

  describe("PATCH /:id/status (HR Admin final approval)", () => {
    beforeEach(async () => {
      await seedEmployee("emp-1", {
        fullName: "Alice",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-3", { fullName: "Charlie" });
      await seedEmployee("mgr-1", { fullName: "Manager One" });
    });

    async function seed(
      docId: string,
      overrides: Record<string, unknown> = {},
    ) {
      await seedLeaveRequest(docId, {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        submittedAt: new Date(),
        ...overrides,
      });
    }

    it("approves a manager_approved request and records the reviewer", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("approved");
      expect(lr.reviewedBy).toBe("admin-1");
      expect(typeof lr.reviewedAt).toBe("string");
    });

    it("rejects a manager_approved request with the admin's reason", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "rejected", rejectionReason: "Policy violation" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("rejected");
      expect(lr.reviewedBy).toBe("admin-1");
      expect(typeof lr.reviewedAt).toBe("string");
      expect(lr.rejectionReason).toBe("Policy violation");
    });

    it("returns 400 when rejecting without a rejectionReason", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "rejected" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_REJECTION_REASON");
    });

    it("approves a pending request directly when the employee has no Line Manager", async () => {
      await seed("r3", { employeeId: "emp-3", status: "pending" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r3/status"),
        adminToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.status).toBe("approved");
      expect(lr.reviewedBy).toBe("admin-1");
    });

    it("rejects a pending request directly when the employee has no Line Manager", async () => {
      await seed("r3", { employeeId: "emp-3", status: "pending" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r3/status"),
        adminToken,
      ).send({ status: "rejected", rejectionReason: "Not eligible" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("rejected");
    });

    it("returns 400 when approving a pending request whose employee has a Line Manager", async () => {
      await seed("r1", { status: "pending" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("returns 400 when the request is already approved", async () => {
      await seed("r1", { status: "approved" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("returns 400 for an invalid final target status", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "manager_approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 404 when the leave request does not exist", async () => {
      const res = await authed(
        request(app).patch("/api/leave-requests/nonexistent/status"),
        adminToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("preserves the manager's approval history through the full two-stage flow", async () => {
      await seed("r1", { status: "pending" });

      const first = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "manager_approved" });
      expect(first.status).toBe(200);
      expect(first.body.leaveRequest.managerId).toBe("mgr-1");

      const second = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "approved" });
      expect(second.status).toBe(200);
      const lr = second.body.leaveRequest;
      expect(lr.status).toBe("approved");
      expect(lr.managerId).toBe("mgr-1");
      expect(typeof lr.managerActionAt).toBe("string");
      expect(lr.reviewedBy).toBe("admin-1");
    });

    it("writes a leave_request.approve audit entry", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "approved" });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.approve");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe("admin-1");
      expect(entry.actorRole).toBe("admin");
      expect(entry.targetType).toBe("LeaveRequest");
      expect(entry.diff).toEqual({
        status: { before: "manager_approved", after: "approved" },
      });
    });

    it("writes a leave_request.reject audit entry", async () => {
      await seed("r1", {
        status: "manager_approved",
        managerId: "mgr-1",
        managerActionAt: new Date(),
      });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        adminToken,
      ).send({ status: "rejected", rejectionReason: "Not enough staff" });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.reject");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.diff).toEqual({
        status: { before: "manager_approved", after: "rejected" },
      });
    });
  });

  // ==========================================================================
  // PATCH /:id/status — Employee cancellation (Ticket 09)
  // ==========================================================================

  describe("PATCH /:id/status (Employee Cancellation)", () => {
    beforeEach(async () => {
      await seedEmployee("emp-1", {
        fullName: "Alice",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("emp-2", {
        fullName: "Bob",
        lineManagerId: "mgr-1",
      });
      await seedEmployee("mgr-1", { fullName: "Manager One" });
    });

    async function seed(
      docId: string,
      overrides: Record<string, unknown> = {},
    ) {
      await seedLeaveRequest(docId, {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
        ...overrides,
      });
    }

    it("cancels the employee's own pending request", async () => {
      await seed("r1");

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        empToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("cancelled");
    });

    it("returns 400 when cancelling a non-pending (approved) request", async () => {
      await seed("r1", { status: "approved" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        empToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("returns 400 when the request is already cancelled", async () => {
      await seed("r1", { status: "cancelled" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        empToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS_TRANSITION");
    });

    it("returns 403 when cancelling another employee's request", async () => {
      await seed("r2", { employeeId: "emp-2" });

      const res = await authed(
        request(app).patch("/api/leave-requests/r2/status"),
        empToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("lets a Line Manager cancel their own pending request", async () => {
      await seed("rm", { employeeId: "mgr-1" });

      const res = await authed(
        request(app).patch("/api/leave-requests/rm/status"),
        mgrToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("cancelled");
    });

    it("returns 400 when a Line Manager tries to cancel a direct report's request", async () => {
      await seed("r1");

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        mgrToken,
      ).send({ status: "cancelled" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 400 for an invalid cancellation target status", async () => {
      await seed("r1");

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        empToken,
      ).send({ status: "approved" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app)
        .patch("/api/leave-requests/r1/status")
        .send({ status: "cancelled" });

      expect(res.status).toBe(401);
    });

    it("writes a leave_request.cancel audit entry", async () => {
      await seed("r1");

      const res = await authed(
        request(app).patch("/api/leave-requests/r1/status"),
        empToken,
      ).send({ status: "cancelled" });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.cancel");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe("emp-1");
      expect(entry.actorRole).toBe("employee");
      expect(entry.targetType).toBe("LeaveRequest");
      expect(entry.diff).toEqual({
        status: { before: "pending", after: "cancelled" },
      });
    });
  });

  // ==========================================================================
  // PUT /:id — HR Admin override (LEAVE-15, Ticket 08)
  // ==========================================================================

  describe("PUT /:id (HR Admin override)", () => {
    async function seed(
      docId: string,
      overrides: Record<string, unknown> = {},
    ) {
      await seedLeaveRequest(docId, {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Old reason",
        status: "pending",
        submittedAt: new Date(),
        ...overrides,
      });
    }

    it("updates a substantive field on a request regardless of status", async () => {
      await seed("r1", { status: "approved" });

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ reason: "Updated reason" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.reason).toBe("Updated reason");
      expect(lr.status).toBe("approved");
    });

    it("modifies the status directly", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ status: "approved" });

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("approved");
    });

    it("updates dates and numberOfDays together", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({
        startDate: "2026-09-01",
        endDate: "2026-09-03",
        numberOfDays: 3,
      });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.startDate).toBe("2026-09-01");
      expect(lr.endDate).toBe("2026-09-03");
      expect(lr.numberOfDays).toBe(3);
    });

    it("returns 400 for an invalid status value", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ status: "not-a-status" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("returns 400 for an invalid date", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ startDate: "not-a-date" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_DATE");
    });

    it("ignores system / attribution fields in the body", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ reviewedBy: "hacker", managerId: "someone-else" });

      expect(res.status).toBe(200);
      const lr = res.body.leaveRequest;
      expect(lr.reviewedBy).toBeUndefined();
      expect(lr.managerId).toBeUndefined();
    });

    it("returns the unchanged request for an empty body", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({});

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.reason).toBe("Old reason");
    });

    it("returns 403 for a Line Manager token", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
        mgrToken,
      ).send({ reason: "x" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for an Employee token", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
        empToken,
      ).send({ reason: "x" });

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when the leave request does not exist", async () => {
      const res = await authed(
        request(app).put("/api/leave-requests/nonexistent"),
      ).send({ reason: "x" });

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app)
        .put("/api/leave-requests/r1")
        .send({ reason: "x" });

      expect(res.status).toBe(401);
    });

    it("writes a leave_request.update audit entry with a diff", async () => {
      await seed("r1");

      const res = await authed(
        request(app).put("/api/leave-requests/r1"),
      ).send({ reason: "New reason" });
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.update");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe("admin-1");
      expect(entry.actorRole).toBe("admin");
      expect(entry.diff).toEqual({
        reason: { before: "Old reason", after: "New reason" },
      });
    });
  });

  // ==========================================================================
  // DELETE /:id — HR Admin override (LEAVE-15, Ticket 08)
  // ==========================================================================

  describe("DELETE /:id (HR Admin override)", () => {
    async function seed(
      docId: string,
      overrides: Record<string, unknown> = {},
    ) {
      await seedLeaveRequest(docId, {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        startDate: "2026-08-10",
        endDate: "2026-08-14",
        isHalfDay: false,
        numberOfDays: 5,
        reason: "Vacation",
        status: "pending",
        submittedAt: new Date(),
        ...overrides,
      });
    }

    it("deletes a request and returns it", async () => {
      await seed("r1");

      const res = await authed(request(app).delete("/api/leave-requests/r1"));

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.leaveRequestId).toBe("r1");

      const get = await authed(request(app).get("/api/leave-requests/r1"));
      expect(get.status).toBe(404);
    });

    it("deletes a request regardless of its status", async () => {
      await seed("r1", { status: "approved" });

      const res = await authed(request(app).delete("/api/leave-requests/r1"));

      expect(res.status).toBe(200);
      expect(res.body.leaveRequest.status).toBe("approved");
    });

    it("returns 403 for a Line Manager token", async () => {
      await seed("r1");

      const res = await authed(
        request(app).delete("/api/leave-requests/r1"),
        mgrToken,
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 403 for an Employee token", async () => {
      await seed("r1");

      const res = await authed(
        request(app).delete("/api/leave-requests/r1"),
        empToken,
      );

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("returns 404 when the leave request does not exist", async () => {
      const res = await authed(
        request(app).delete("/api/leave-requests/nonexistent"),
      );

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("returns 401 when no token is provided", async () => {
      const res = await request(app).delete("/api/leave-requests/r1");

      expect(res.status).toBe(401);
    });

    it("writes a leave_request.delete audit entry", async () => {
      await seed("r1");

      const res = await authed(request(app).delete("/api/leave-requests/r1"));
      expect(res.status).toBe(200);

      const entries = await auditEntries("leave_request.delete");
      expect(entries.length).toBeGreaterThanOrEqual(1);
      const entry = entries.find(
        (e: { targetId: string }) => e.targetId === "r1",
      );
      expect(entry).toBeDefined();
      expect(entry.actorId).toBe("admin-1");
      expect(entry.actorRole).toBe("admin");
      expect(entry.targetType).toBe("LeaveRequest");
    });
  });
});
