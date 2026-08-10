import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () => await import("./helpers/firebase-mock"));

import { createApp } from "../src/app";
import { makeToken, resetMock, db } from "./helpers/firebase-mock";

const app = createApp();
const adminToken = makeToken("admin-1", "admin");
const managerToken = makeToken("manager-1", "manager");
const empToken = makeToken("emp-1", "employee");

beforeEach(() => {
  resetMock();
});

// ---- helpers ---------------------------------------------------------------

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
  overrides: Partial<{
    baseSalary: number;
    deductions: Array<{ label: string; amount: number }>;
    status: "draft" | "published";
  }> = {},
) {
  const payslipId = `${employeeId}_${year}-${String(month).padStart(2, "0")}`;
  const baseSalary = overrides.baseSalary ?? 5000;
  const deductions = overrides.deductions ?? [];
  const netSalary =
    baseSalary - deductions.reduce((s, d) => s + d.amount, 0);
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
      baseSalary,
      deductions,
      netSalary,
      generatedAt: new Date("2026-06-30T00:00:00Z"),
      status: overrides.status ?? "draft",
    });
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

const validBody = { employeeId: "emp-1", month: 6, year: 2026 };

// ============================================================================
// Payslips
// ============================================================================

describe("Payslips — /api/payslips", () => {
  // ---- POST (generate) -----------------------------------------------------

  describe("POST /", () => {
    it("401 without auth", async () => {
      const res = await request(app).post("/api/payslips").send(validBody);
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).post("/api/payslips"),
        managerToken,
      ).send(validBody);
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).post("/api/payslips"),
        empToken,
      ).send(validBody);
      expect(res.status).toBe(403);
    });

    it("201 for HR Admin and persists a draft with a salary snapshot", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", 4200);
      const res = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );

      expect(res.status).toBe(201);
      expect(res.body.payslip).toMatchObject({
        payslipId: "emp-1_2026-06",
        employeeId: "emp-1",
        month: 6,
        year: 2026,
        baseSalary: 4200,
        deductions: [],
        netSalary: 4200,
        status: "draft",
      });
      expect(new Date(res.body.payslip.generatedAt).getTime()).not.toBeNaN();

      const doc = await db
        .collection("payrollProfiles")
        .doc("emp-1")
        .collection("payslips")
        .doc("emp-1_2026-06")
        .get();
      expect(doc.exists).toBe(true);
      expect(doc.data()?.status).toBe("draft");
    });

    it("404 when the employee has no payroll profile", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("409 when a payslip already exists for the employee/month/year", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PAYSLIP_EXISTS");
    });

    it("regression: first generation succeeds, second returns 409, only one payslip exists", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");

      const first = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(first.status).toBe(201);

      const second = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(second.status).toBe(409);
      expect(second.body.error.code).toBe("PAYSLIP_EXISTS");

      const snap = await db.collectionGroup("payslips").get();
      expect(snap.size).toBe(1);
      expect(snap.docs[0].data()?.payslipId).toBe("emp-1_2026-06");
    });

    it("400 when employeeId is missing", async () => {
      const res = await authed(request(app).post("/api/payslips")).send({
        month: 6,
        year: 2026,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_EMPLOYEE_ID");
    });

    it("400 when month is missing or out of range", async () => {
      for (const month of [undefined, 0, 13, 6.5, "6"]) {
        const res = await authed(request(app).post("/api/payslips")).send({
          ...validBody,
          month,
        });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_MONTH");
      }
    });

    it("400 when year is missing or out of range", async () => {
      for (const year of [undefined, 1999, 2026.5, "2026"]) {
        const res = await authed(request(app).post("/api/payslips")).send({
          ...validBody,
          year,
        });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_YEAR");
      }
    });

    it("writes a payslip.create audit entry", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(res.status).toBe(201);

      const created = await auditEntries("payslip.create");
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        actorId: "admin-1",
        actorRole: "admin",
        targetType: "Payslip",
        targetId: "emp-1_2026-06",
      });
    });

    it("regression: a later salary change does not alter the generated snapshot", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", 5000);
      const generate = await authed(request(app).post("/api/payslips")).send(
        validBody,
      );
      expect(generate.status).toBe(201);
      expect(generate.body.payslip.baseSalary).toBe(5000);

      // HR Admin raises the salary on the payroll profile.
      const update = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "1234567890",
        bankName: "Test Bank",
        baseSalary: 7000,
      });
      expect(update.status).toBe(200);

      // The historical payslip keeps its own snapshot.
      const doc = await db
        .collection("payrollProfiles")
        .doc("emp-1")
        .collection("payslips")
        .doc("emp-1_2026-06")
        .get();
      expect(doc.data()?.baseSalary).toBe(5000);
      expect(doc.data()?.netSalary).toBe(5000);
    });
  });

  // ---- GET / (list) --------------------------------------------------------

  describe("GET /", () => {
    it("401 without auth", async () => {
      const res = await request(app).get("/api/payslips");
      expect(res.status).toBe(401);
    });

    it("200 for HR Admin returning all payslips", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });
      await seedPayslip("emp-1", 2026, 5, { status: "published" });

      const res = await authed(request(app).get("/api/payslips"));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);
    });

    it("200 for HR Admin filtered by employeeId", async () => {
      await seedEmployee("emp-1");
      await seedEmployee("emp-2");
      await seedProfile("emp-1");
      await seedProfile("emp-2");
      await seedPayslip("emp-1", 2026, 6);
      await seedPayslip("emp-2", 2026, 6);

      const res = await authed(
        request(app).get("/api/payslips?employeeId=emp-1"),
      );
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.payslips[0].employeeId).toBe("emp-1");
    });

    it("200 for HR Admin filtered by status", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });
      await seedPayslip("emp-1", 2026, 5, { status: "published" });

      const res = await authed(request(app).get("/api/payslips?status=draft"));
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.payslips[0].status).toBe("draft");
    });

    it("400 for HR Admin with an invalid status filter", async () => {
      const res = await authed(
        request(app).get("/api/payslips?status=void"),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("200 for an Employee returning only their own published payslips", async () => {
      await seedEmployee("emp-1");
      await seedEmployee("emp-2");
      await seedProfile("emp-1");
      await seedProfile("emp-2");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });
      await seedPayslip("emp-1", 2026, 5, { status: "draft" });
      await seedPayslip("emp-2", 2026, 6, { status: "published" });

      const res = await authed(request(app).get("/api/payslips"), empToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.payslips[0].payslipId).toBe("emp-1_2026-06");
    });

    it("200 for a Line Manager returning only their own published payslips", async () => {
      await seedEmployee("manager-1");
      await seedProfile("manager-1");
      await seedPayslip("manager-1", 2026, 6, { status: "published" });
      await seedPayslip("manager-1", 2026, 5, { status: "draft" });

      const res = await authed(request(app).get("/api/payslips"), managerToken);
      expect(res.status).toBe(200);
      expect(res.body.total).toBe(1);
      expect(res.body.payslips[0].status).toBe("published");
    });

    it("sorts newest first (year desc, then month desc)", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2025, 12);
      await seedPayslip("emp-1", 2026, 5);
      await seedPayslip("emp-1", 2026, 6);

      const res = await authed(request(app).get("/api/payslips"));
      expect(res.status).toBe(200);
      expect(res.body.payslips.map((p: { payslipId: string }) => p.payslipId)).toEqual([
        "emp-1_2026-06",
        "emp-1_2026-05",
        "emp-1_2025-12",
      ]);
    });
  });

  // ---- GET /:id ------------------------------------------------------------

  describe("GET /:id", () => {
    it("401 without auth", async () => {
      const res = await request(app).get("/api/payslips/emp-1_2026-06");
      expect(res.status).toBe(401);
    });

    it("200 for HR Admin reading any payslip", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });

      const res = await authed(request(app).get("/api/payslips/emp-1_2026-06"));
      expect(res.status).toBe(200);
      expect(res.body.payslip).toMatchObject({
        payslipId: "emp-1_2026-06",
        employeeId: "emp-1",
      });
    });

    it("200 for the owning Employee reading their published payslip", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).get("/api/payslips/emp-1_2026-06"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.payslip.status).toBe("published");
    });

    it("403 for an Employee reading their own draft payslip", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });

      const res = await authed(
        request(app).get("/api/payslips/emp-1_2026-06"),
        empToken,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("403 for an Employee reading another employee's published payslip", async () => {
      await seedEmployee("emp-2");
      await seedProfile("emp-2");
      await seedPayslip("emp-2", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).get("/api/payslips/emp-2_2026-06"),
        empToken,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("403 for a Line Manager reading another employee's payslip", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).get("/api/payslips/emp-1_2026-06"),
        managerToken,
      );
      expect(res.status).toBe(403);
    });

    it("404 when the payslip does not exist", async () => {
      const res = await authed(request(app).get("/api/payslips/ghost_2026-06"));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ---- PUT /:id (deductions) ----------------------------------------------

  describe("PUT /:id", () => {
    const deductionsBody = {
      deductions: [
        { label: "EPF", amount: 500 },
        { label: "Loan repayment", amount: 200 },
      ],
    };

    it("401 without auth", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await request(app)
        .put("/api/payslips/emp-1_2026-06")
        .send(deductionsBody);
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
        managerToken,
      ).send(deductionsBody);
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
        empToken,
      ).send(deductionsBody);
      expect(res.status).toBe(403);
    });

    it("200 for HR Admin and recomputes netSalary", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", 5000);
      await seedPayslip("emp-1", 2026, 6);

      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
      ).send(deductionsBody);

      expect(res.status).toBe(200);
      expect(res.body.payslip).toMatchObject({
        baseSalary: 5000,
        netSalary: 4300,
        deductions: deductionsBody.deductions,
        status: "draft",
      });

      const doc = await db
        .collection("payrollProfiles")
        .doc("emp-1")
        .collection("payslips")
        .doc("emp-1_2026-06")
        .get();
      expect(doc.data()?.netSalary).toBe(4300);
    });

    it("400 when total deductions exceed base salary", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", 1000);
      await seedPayslip("emp-1", 2026, 6, { baseSalary: 1000 });

      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
      ).send({
        deductions: [
          { label: "EPF", amount: 600 },
          { label: "Loan", amount: 500 },
        ],
      });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("DEDUCTIONS_EXCEED_SALARY");
    });

    it("400 when a deduction is missing a label or amount", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);

      for (const body of [
        { deductions: [{ label: "EPF" }] },
        { deductions: [{ amount: 100 }] },
        { deductions: [{ label: "EPF", amount: "500" }] },
        { deductions: [{ label: "EPF", amount: -100 }] },
        { deductions: "nope" },
      ]) {
        const res = await authed(
          request(app).put("/api/payslips/emp-1_2026-06"),
        ).send(body);
        expect(res.status).toBe(400);
      }
    });

    it("400 when the payslip is already published", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
      ).send(deductionsBody);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("404 when the payslip does not exist", async () => {
      const res = await authed(
        request(app).put("/api/payslips/ghost_2026-06"),
      ).send(deductionsBody);
      expect(res.status).toBe(404);
    });

    it("writes a payslip.update audit entry with a field-level diff", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", 5000);
      await seedPayslip("emp-1", 2026, 6);

      const res = await authed(
        request(app).put("/api/payslips/emp-1_2026-06"),
      ).send(deductionsBody);
      expect(res.status).toBe(200);

      const updates = await auditEntries("payslip.update");
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "Payslip",
        targetId: "emp-1_2026-06",
      });
      expect(updates[0].diff).toEqual({
        deductions: { before: [], after: deductionsBody.deductions },
        netSalary: { before: 5000, after: 4300 },
      });
    });
  });

  // ---- PATCH /:id/publish --------------------------------------------------

  describe("PATCH /:id/publish", () => {
    it("401 without auth", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await request(app).patch(
        "/api/payslips/emp-1_2026-06/publish",
      );
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).patch("/api/payslips/emp-1_2026-06/publish"),
        managerToken,
      );
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).patch("/api/payslips/emp-1_2026-06/publish"),
        empToken,
      );
      expect(res.status).toBe(403);
    });

    it("200 for HR Admin publishing a draft", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });

      const res = await authed(
        request(app).patch("/api/payslips/emp-1_2026-06/publish"),
      );

      expect(res.status).toBe(200);
      expect(res.body.payslip.status).toBe("published");

      const doc = await db
        .collection("payrollProfiles")
        .doc("emp-1")
        .collection("payslips")
        .doc("emp-1_2026-06")
        .get();
      expect(doc.data()?.status).toBe("published");
    });

    it("400 when the payslip is already published", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).patch("/api/payslips/emp-1_2026-06/publish"),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("404 when the payslip does not exist", async () => {
      const res = await authed(
        request(app).patch("/api/payslips/ghost_2026-06/publish"),
      );
      expect(res.status).toBe(404);
    });

    it("writes a payslip.publish audit entry", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);

      const res = await authed(
        request(app).patch("/api/payslips/emp-1_2026-06/publish"),
      );
      expect(res.status).toBe(200);

      const published = await auditEntries("payslip.publish");
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "Payslip",
        targetId: "emp-1_2026-06",
      });
      expect(published[0].diff).toEqual({
        status: { before: "draft", after: "published" },
      });
    });
  });

  // ---- DELETE /:id ---------------------------------------------------------

  describe("DELETE /:id", () => {
    it("401 without auth", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await request(app).delete("/api/payslips/emp-1_2026-06");
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).delete("/api/payslips/emp-1_2026-06"),
        managerToken,
      );
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);
      const res = await authed(
        request(app).delete("/api/payslips/emp-1_2026-06"),
        empToken,
      );
      expect(res.status).toBe(403);
    });

    it("200 for HR Admin deleting a draft", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "draft" });

      const res = await authed(
        request(app).delete("/api/payslips/emp-1_2026-06"),
      );

      expect(res.status).toBe(200);
      const doc = await db
        .collection("payrollProfiles")
        .doc("emp-1")
        .collection("payslips")
        .doc("emp-1_2026-06")
        .get();
      expect(doc.exists).toBe(false);
    });

    it("400 when the payslip is already published", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6, { status: "published" });

      const res = await authed(
        request(app).delete("/api/payslips/emp-1_2026-06"),
      );
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_STATUS");
    });

    it("404 when the payslip does not exist", async () => {
      const res = await authed(
        request(app).delete("/api/payslips/ghost_2026-06"),
      );
      expect(res.status).toBe(404);
    });

    it("writes a payslip.delete audit entry", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      await seedPayslip("emp-1", 2026, 6);

      const res = await authed(
        request(app).delete("/api/payslips/emp-1_2026-06"),
      );
      expect(res.status).toBe(200);

      const deleted = await auditEntries("payslip.delete");
      expect(deleted).toHaveLength(1);
      expect(deleted[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "Payslip",
        targetId: "emp-1_2026-06",
      });
    });
  });
});
