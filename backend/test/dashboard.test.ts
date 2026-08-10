import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import request from "supertest";
import type { LeaveBalance } from "../src/types";

vi.mock("../src/config/firebase", async () =>
  await import("./helpers/firebase-mock"),
);

import { createApp } from "../src/app";
import { makeToken, resetMock, db } from "./helpers/firebase-mock";

const app = createApp();

// ---- stable tokens (survive resetMock since tokenMap is not cleared) --------

const adminToken = makeToken("admin-1", "admin");
const managerToken = makeToken("manager-1", "manager");
const empToken = makeToken("emp-1", "employee");
const emp2Token = makeToken("emp-2", "employee");

// ---- current year (robust to the calendar year the tests run in) ------------

const YEAR = new Date().getFullYear();

beforeEach(() => {
  resetMock();
});

// ---- seed helpers -----------------------------------------------------------

async function seedEmployee(
  id: string,
  overrides: { status?: "active" | "inactive"; lineManagerId?: string } = {},
) {
  const doc: Record<string, unknown> = {
    employeeId: id,
    fullName: "Test Employee",
    email: `${id}@example.com`,
    phone: "+234-800-000-0001",
    department: "Engineering",
    jobTitle: "Engineer",
    employmentRole: "full-time",
    startDate: "2024-01-15",
    status: overrides.status ?? "active",
    nationalId: `NID-${id}`,
    address: "12 Main Street",
  };
  if (overrides.lineManagerId) doc.lineManagerId = overrides.lineManagerId;
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

async function seedLeaveRequest(
  docId: string,
  data: {
    employeeId: string;
    leaveTypeId: string;
    status: string;
    startDate: string;
    endDate?: string;
    numberOfDays?: number;
    submittedAt?: Date;
  },
) {
  await db.collection("leaveRequests").doc(docId).set({
    leaveRequestId: docId,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    status: data.status,
    startDate: data.startDate,
    endDate: data.endDate ?? data.startDate,
    isHalfDay: false,
    numberOfDays: data.numberOfDays ?? 1,
    reason: "Test",
    submittedAt: data.submittedAt ?? new Date("2026-01-01T00:00:00Z"),
  });
}

async function seedProfile(employeeId: string, baseSalary = 5000) {
  await db.collection("payrollProfiles").doc(employeeId).set({
    bankAccountNumber: "1234567890",
    bankName: "Test Bank",
    baseSalary,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

async function seedPayslip(
  employeeId: string,
  year: number,
  month: number,
  overrides: Partial<{ status: "draft" | "published" }> = {},
) {
  const payslipId = `${employeeId}_${year}-${String(month).padStart(2, "0")}`;
  await db
    .collection("payrollProfiles")
    .doc(employeeId)
    .collection("payslips")
    .doc(payslipId)
    .set({
      payslipId,
      employeeId,
      month,
      year,
      baseSalary: 5000,
      deductions: [],
      netSalary: 5000,
      generatedAt: new Date("2026-01-01T00:00:00Z"),
      status: overrides.status ?? "draft",
    });
}

function authed(req: request.Test, token: string = adminToken): request.Test {
  return req.set("Authorization", `Bearer ${token}`);
}

// ============================================================================
// Dashboard — /api/dashboard
// ============================================================================

describe("Dashboard — /api/dashboard", () => {
  // ==========================================================================
  // Auth & errors
  // ==========================================================================

  describe("authentication and error handling", () => {
    it("401 without auth", async () => {
      const res = await request(app).get("/api/dashboard");
      expect(res.status).toBe(401);
    });

    it("404 for an Employee whose Employee record does not exist", async () => {
      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("404 for a Line Manager whose Employee record does not exist", async () => {
      const res = await authed(
        request(app).get("/api/dashboard"),
        managerToken,
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ==========================================================================
  // HR Admin
  // ==========================================================================

  describe("HR Admin payload", () => {
    it("activeHeadcount counts only active employees", async () => {
      await seedEmployee("emp-1", { status: "active" });
      await seedEmployee("emp-2", { status: "inactive" });

      const res = await authed(request(app).get("/api/dashboard"));
      expect(res.status).toBe(200);
      expect(res.body.dashboard.activeHeadcount).toBe(1);
    });

    it("managerApprovedLeaveCount counts only manager_approved requests", async () => {
      await seedLeaveRequest("lr-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-10`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });
      await seedLeaveRequest("lr-2", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "manager_approved",
        startDate: `${YEAR}-08-11`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-02T00:00:00Z`),
      });
      await seedLeaveRequest("lr-3", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR}-08-12`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-03T00:00:00Z`),
      });
      await seedLeaveRequest("lr-4", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "rejected",
        startDate: `${YEAR}-08-13`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-04T00:00:00Z`),
      });

      const res = await authed(request(app).get("/api/dashboard"));
      expect(res.status).toBe(200);
      expect(res.body.dashboard.managerApprovedLeaveCount).toBe(1);
    });

    it("draftPayslipCount counts only draft payslips across employees", async () => {
      await seedProfile("emp-1");
      await seedPayslip("emp-1", YEAR, 6, { status: "draft" });
      await seedProfile("emp-2");
      await seedPayslip("emp-2", YEAR, 7, { status: "published" });

      const res = await authed(request(app).get("/api/dashboard"));
      expect(res.status).toBe(200);
      expect(res.body.dashboard.draftPayslipCount).toBe(1);
    });

    it("payload contains exactly the three admin metrics", async () => {
      const res = await authed(request(app).get("/api/dashboard"));
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.dashboard).sort()).toEqual([
        "activeHeadcount",
        "draftPayslipCount",
        "managerApprovedLeaveCount",
      ]);
    });
  });

  // ==========================================================================
  // Line Manager
  // ==========================================================================

  describe("Line Manager payload", () => {
    it("pendingDirectReportLeaveCount counts only pending requests from direct reports", async () => {
      // Manager must have an employee record (auth UID == employeeId).
      await seedEmployee("manager-1");
      await seedEmployee("emp-1", { lineManagerId: "manager-1" });
      await seedEmployee("emp-2", { lineManagerId: "manager-1" });
      await seedEmployee("emp-3"); // reports to nobody (or someone else)

      // emp-1 and emp-2 have pending requests → count 2
      await seedLeaveRequest("lr-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-10`,
        numberOfDays: 2,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });
      await seedLeaveRequest("lr-2", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-11`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-02T00:00:00Z`),
      });

      // emp-3 is NOT a direct report → should not count
      await seedLeaveRequest("lr-3", {
        employeeId: "emp-3",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-12`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-03T00:00:00Z`),
      });

      // Non-pending statuses from direct reports should not count
      await seedLeaveRequest("lr-4", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR}-08-05`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-04T00:00:00Z`),
      });
      await seedLeaveRequest("lr-5", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "manager_approved",
        startDate: `${YEAR}-08-06`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-05T00:00:00Z`),
      });

      const res = await authed(
        request(app).get("/api/dashboard"),
        managerToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.pendingDirectReportLeaveCount).toBe(2);
    });

    it("payload contains exactly one field", async () => {
      await seedEmployee("manager-1");
      const res = await authed(
        request(app).get("/api/dashboard"),
        managerToken,
      );
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.dashboard).sort()).toEqual([
        "pendingDirectReportLeaveCount",
      ]);
    });
  });

  // ==========================================================================
  // Employee
  // ==========================================================================

  describe("Employee payload", () => {
    it("leaveBalances returns only capped leave types", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("annual", "Annual", true, 14);
      await seedLeaveType("medical", "Medical", true, 14);
      await seedLeaveType("unpaid", "Unpaid", false, 0);
      await seedEntitlement("annual", 14);
      await seedEntitlement("medical", 14);

      // emp-1 used 4.5 days on annual (5-day request minus weekend = varies,
      // but we seed numberOfDays directly).
      await seedLeaveRequest("lr-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR}-08-10`,
        endDate: `${YEAR}-08-14`,
        numberOfDays: 4.5,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);

      const { leaveBalances } = res.body.dashboard;
      expect(leaveBalances).toHaveLength(2);

      const annual = leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "annual");
      expect(annual).toBeDefined();
      expect(annual.name).toBe("Annual");
      expect(annual.balance).toBe(14 - 4.5);

      const medical = leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "medical");
      expect(medical).toBeDefined();
      expect(medical.balance).toBe(14);

      // Unpaid is uncapped → must not appear.
      expect(leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "unpaid")).toBeUndefined();
    });

    // Regression: proves consistency with the Ticket 06 entitlement / usage rules.
    // Formula per C-04 / LEAVE-17 / computeUsedDays:
    //   effectiveDays = override(employeeId, typeId) ?? companyDefault(typeId)
    //   used = SUM(numberOfDays) for requests where:
    //     - employeeId matches
    //     - leaveTypeId matches
    //     - status ∈ {pending, manager_approved, approved}
    //     - year(startDate) == currentYear
    //   balance = effectiveDays − used
    it("regression: leave balance matches Ticket06 rules (override wins, excluded statuses/year-scoped, no entitlement omitted)", async () => {
      await seedEmployee("emp-1");

      // Leave types: annual (capped, default 14), medical (capped, default 14),
      // unpaid (uncapped), bonus (capped but no entitlement configured).
      await seedLeaveType("annual", "Annual", true, 14);
      await seedLeaveType("medical", "Medical", true, 14);
      await seedLeaveType("unpaid", "Unpaid", false, 0);
      await seedLeaveType("bonus", "Bonus", true, 20);

      // Company defaults: annual 14, medical 14. No entitlement for bonus.
      await seedEntitlement("annual", 14);
      await seedEntitlement("medical", 14);

      // Per-employee override: annual effective = 10 (wins over default 14).
      await seedOverride("emp-1", "annual", 10);

      // Seed requests for emp-1 in the current year:
      // ── annual ──
      // approved 2 days → counts
      await seedLeaveRequest("lr-annual-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR}-08-10`,
        endDate: `${YEAR}-08-11`,
        numberOfDays: 2,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });
      // pending 1 day → counts
      await seedLeaveRequest("lr-annual-2", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-12`,
        endDate: `${YEAR}-08-12`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-02T00:00:00Z`),
      });
      // cancelled 3 days → excluded
      await seedLeaveRequest("lr-annual-3", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "cancelled",
        startDate: `${YEAR}-07-01`,
        endDate: `${YEAR}-07-03`,
        numberOfDays: 3,
        submittedAt: new Date(`${YEAR}-07-01T00:00:00Z`),
      });
      // rejected 4 days → excluded
      await seedLeaveRequest("lr-annual-4", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "rejected",
        startDate: `${YEAR}-07-04`,
        endDate: `${YEAR}-07-07`,
        numberOfDays: 4,
        submittedAt: new Date(`${YEAR}-07-04T00:00:00Z`),
      });
      // manager_approved 1 day → counts
      await seedLeaveRequest("lr-annual-5", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "manager_approved",
        startDate: `${YEAR}-08-14`,
        endDate: `${YEAR}-08-14`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-03T00:00:00Z`),
      });

      // Previous year: approved 5 days → excluded (year-scoped)
      await seedLeaveRequest("lr-annual-prev", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR - 1}-12-20`,
        endDate: `${YEAR - 1}-12-26`,
        numberOfDays: 5,
        submittedAt: new Date(`${YEAR - 1}-12-20T00:00:00Z`),
      });

      // ── medical ── approved 3 days
      await seedLeaveRequest("lr-medical-1", {
        employeeId: "emp-1",
        leaveTypeId: "medical",
        status: "approved",
        startDate: `${YEAR}-08-01`,
        endDate: `${YEAR}-08-03`,
        numberOfDays: 3,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);
      const { leaveBalances } = res.body.dashboard;

      // Annual: effective 10 (override) − used (2 approved + 1 pending + 1
      // manager_approved = 4) → balance 6.
      const annual = leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "annual");
      expect(annual).toBeDefined();
      expect(annual.balance).toBe(6);

      // Medical: effective 14 (company default) − used 3 = 11.
      const medical = leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "medical");
      expect(medical).toBeDefined();
      expect(medical.balance).toBe(11);

      // Unpaid (uncapped) and bonus (no entitlement) must not appear.
      expect(leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "unpaid")).toBeUndefined();
      expect(leaveBalances.find((b: LeaveBalance) => b.leaveTypeId === "bonus")).toBeUndefined();
    });

    it("capped leave type with no entitlement is omitted", async () => {
      await seedEmployee("emp-1");
      await seedLeaveType("training", "Training", true, 5);
      // No entitlement seeded for training.

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.leaveBalances).toHaveLength(0);
    });

    it("pendingLeaveRequests returns own pending requests sorted submittedAt desc", async () => {
      await seedEmployee("emp-1");
      await seedEmployee("emp-2");

      // emp-1: two pending, one approved (should not appear)
      await seedLeaveRequest("lr-1", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-10`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-01T00:00:00Z`),
      });
      await seedLeaveRequest("lr-2", {
        employeeId: "emp-1",
        leaveTypeId: "medical",
        status: "pending",
        startDate: `${YEAR}-08-11`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-02T00:00:00Z`),
      });
      await seedLeaveRequest("lr-3", {
        employeeId: "emp-1",
        leaveTypeId: "annual",
        status: "approved",
        startDate: `${YEAR}-08-05`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-03T00:00:00Z`),
      });

      // emp-2: one pending (should not appear for emp-1)
      await seedLeaveRequest("lr-4", {
        employeeId: "emp-2",
        leaveTypeId: "annual",
        status: "pending",
        startDate: `${YEAR}-08-12`,
        numberOfDays: 1,
        submittedAt: new Date(`${YEAR}-08-04T00:00:00Z`),
      });

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);

      const { pendingLeaveRequests } = res.body.dashboard;
      expect(pendingLeaveRequests).toHaveLength(2);

      // Newer (08-02) first.
      expect(pendingLeaveRequests[0].leaveRequestId).toBe("lr-2");
      expect(pendingLeaveRequests[0].leaveTypeId).toBe("medical");
      expect(pendingLeaveRequests[0].status).toBe("pending");
      expect(pendingLeaveRequests[1].leaveRequestId).toBe("lr-1");
      expect(pendingLeaveRequests[1].leaveTypeId).toBe("annual");

      // Full LeaveRequest shape (spot-check fields).
      expect(typeof pendingLeaveRequests[0].leaveRequestId).toBe("string");
      expect(typeof pendingLeaveRequests[0].employeeId).toBe("string");
      expect(typeof pendingLeaveRequests[0].numberOfDays).toBe("number");
      expect(typeof pendingLeaveRequests[0].reason).toBe("string");
    });

    it("latestPayslip returns the most recent published payslip by year then month desc", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");

      await seedPayslip("emp-1", YEAR - 1, 12, { status: "published" });
      await seedPayslip("emp-1", YEAR, 3, { status: "published" });
      await seedPayslip("emp-1", YEAR, 2, { status: "published" });
      // Draft in a later month — must be excluded.
      await seedPayslip("emp-1", YEAR, 6, { status: "draft" });

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.latestPayslip).toEqual({
        month: 3,
        year: YEAR,
        status: "published",
      });
    });

    it("latestPayslip is null when no published payslips exist", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", YEAR, 1, { status: "draft" });

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.latestPayslip).toBeNull();
    });

    it("latestPayslip is null when the employee has no payslip subcollection", async () => {
      await seedEmployee("emp-1");
      // No profile seeded at all.

      const res = await authed(
        request(app).get("/api/dashboard"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.latestPayslip).toBeNull();
    });
  });

  // ==========================================================================
  // Role isolation — payloads do not bleed between roles
  // ==========================================================================

  describe("role isolation", () => {
    it("employee payload contains only employee fields", async () => {
      await seedEmployee("emp-2");
      const res = await authed(
        request(app).get("/api/dashboard"),
        emp2Token,
      );
      expect(res.status).toBe(200);
      expect(Object.keys(res.body.dashboard).sort()).toEqual([
        "latestPayslip",
        "leaveBalances",
        "pendingLeaveRequests",
      ]);
    });

    it("manager payload does not contain employee or admin fields", async () => {
      await seedEmployee("manager-1");
      const res = await authed(
        request(app).get("/api/dashboard"),
        managerToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.dashboard.activeHeadcount).toBeUndefined();
      expect(res.body.dashboard.leaveBalances).toBeUndefined();
      expect(res.body.dashboard.pendingDirectReportLeaveCount).toBeDefined();
    });

    it("admin payload does not contain employee or manager fields", async () => {
      const res = await authed(request(app).get("/api/dashboard"));
      expect(res.status).toBe(200);
      expect(res.body.dashboard.leaveBalances).toBeUndefined();
      expect(res.body.dashboard.pendingDirectReportLeaveCount).toBeUndefined();
      expect(res.body.dashboard.pendingLeaveRequests).toBeUndefined();
      expect(res.body.dashboard.activeHeadcount).toBeDefined();
    });
  });

  // ==========================================================================
  // Audit — no state changes, so no audit entries written
  // ==========================================================================

  it("dashboard GET writes no audit entries", async () => {
    await seedEmployee("emp-1");
    const res = await authed(
      request(app).get("/api/dashboard"),
      empToken,
    );
    expect(res.status).toBe(200);

    const audit = await authed(request(app).get("/api/audit-log"));
    expect(audit.status).toBe(200);
    expect(audit.body.entries).toEqual([]);
  });
});
