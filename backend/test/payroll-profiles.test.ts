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

async function seedProfile(
  employeeId: string,
  data: Partial<{
    bankAccountNumber: string;
    bankName: string;
    baseSalary: number;
  }> = {},
) {
  await db.collection("payrollProfiles").doc(employeeId).set({
    bankAccountNumber: data.bankAccountNumber ?? "1234567890",
    bankName: data.bankName ?? "Test Bank",
    baseSalary: data.baseSalary ?? 5000,
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
  });
}

/** Seeds a payslip-shaped doc under /payrollProfiles/{id}/payslips (Ticket 11). */
async function seedPayslip(
  employeeId: string,
  payslipId: string,
  baseSalary: number,
) {
  await db.doc(`payrollProfiles/${employeeId}/payslips/${payslipId}`).set({
    payslipId,
    employeeId,
    month: 6,
    year: 2026,
    baseSalary,
    deductions: [],
    netSalary: baseSalary,
    status: "published",
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

const validBody = {
  employeeId: "emp-1",
  bankAccountNumber: "1234567890",
  bankName: "Test Bank",
  baseSalary: 5000,
};

// ============================================================================
// Payroll Profiles
// ============================================================================

describe("Payroll Profiles — /api/payroll-profiles", () => {
  // ---- POST ----------------------------------------------------------------

  describe("POST /", () => {
    it("401 without auth", async () => {
      const res = await request(app).post("/api/payroll-profiles").send(validBody);
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      const res = await authed(
        request(app).post("/api/payroll-profiles"),
        managerToken,
      ).send(validBody);
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      const res = await authed(
        request(app).post("/api/payroll-profiles"),
        empToken,
      ).send(validBody);
      expect(res.status).toBe(403);
    });

    it("201 for HR Admin and persists the profile", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/payroll-profiles")).send(
        validBody,
      );

      expect(res.status).toBe(201);
      expect(res.body.profile).toMatchObject({
        employeeId: "emp-1",
        bankAccountNumber: "1234567890",
        bankName: "Test Bank",
        baseSalary: 5000,
      });
      // Timestamps are stamped on the document.
      expect(new Date(res.body.profile.createdAt).getTime()).not.toBeNaN();
      expect(new Date(res.body.profile.updatedAt).getTime()).not.toBeNaN();

      const doc = await db.collection("payrollProfiles").doc("emp-1").get();
      expect(doc.exists).toBe(true);
      expect(doc.data()?.baseSalary).toBe(5000);
    });

    it("409 when a profile already exists for the employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(request(app).post("/api/payroll-profiles")).send(
        validBody,
      );
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe("PAYROLL_PROFILE_EXISTS");
    });

    it("404 when the employee does not exist", async () => {
      const res = await authed(request(app).post("/api/payroll-profiles")).send({
        ...validBody,
        employeeId: "ghost-1",
      });
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });

    it("400 when employeeId is missing", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/payroll-profiles")).send({
        bankAccountNumber: "1234567890",
        bankName: "Test Bank",
        baseSalary: 5000,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_EMPLOYEE_ID");
    });

    it("400 when bankAccountNumber is missing or blank", async () => {
      await seedEmployee("emp-1");
      for (const body of [
        { ...validBody, bankAccountNumber: undefined },
        { ...validBody, bankAccountNumber: "   " },
      ]) {
        const res = await authed(request(app).post("/api/payroll-profiles")).send(body);
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_BANK_ACCOUNT_NUMBER");
      }
    });

    it("400 when bankName is missing", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/payroll-profiles")).send({
        ...validBody,
        bankName: undefined,
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_BANK_NAME");
    });

    it("400 when baseSalary is missing, non-numeric, or non-positive", async () => {
      await seedEmployee("emp-1");
      for (const baseSalary of [undefined, "5000", 0, -100]) {
        const res = await authed(request(app).post("/api/payroll-profiles")).send({
          ...validBody,
          baseSalary,
        });
        expect(res.status).toBe(400);
        expect(res.body.error.code).toBe("INVALID_BASE_SALARY");
      }
    });

    it("writes a payroll_profile.create audit entry", async () => {
      await seedEmployee("emp-1");
      const res = await authed(request(app).post("/api/payroll-profiles")).send(
        validBody,
      );
      expect(res.status).toBe(201);

      const created = await auditEntries("payroll_profile.create");
      expect(created).toHaveLength(1);
      expect(created[0]).toMatchObject({
        actorId: "admin-1",
        actorRole: "admin",
        targetType: "PayrollProfile",
        targetId: "emp-1",
      });
    });
  });

  // ---- GET ----------------------------------------------------------------

  describe("GET /:employeeId", () => {
    it("401 without auth", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await request(app).get("/api/payroll-profiles/emp-1");
      expect(res.status).toBe(401);
    });

    it("200 for HR Admin reading any profile", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", { baseSalary: 4200 });
      const res = await authed(request(app).get("/api/payroll-profiles/emp-1"));
      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({
        employeeId: "emp-1",
        bankAccountNumber: "1234567890",
        baseSalary: 4200,
      });
    });

    it("200 for the owning Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).get("/api/payroll-profiles/emp-1"),
        empToken,
      );
      expect(res.status).toBe(200);
      expect(res.body.profile.employeeId).toBe("emp-1");
    });

    it("403 for an Employee reading another employee's profile", async () => {
      await seedEmployee("emp-2");
      await seedProfile("emp-2");
      const res = await authed(
        request(app).get("/api/payroll-profiles/emp-2"),
        empToken,
      );
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    });

    it("403 for a Line Manager even on their own profile", async () => {
      await seedEmployee("manager-1");
      await seedProfile("manager-1");
      const res = await authed(
        request(app).get("/api/payroll-profiles/manager-1"),
        managerToken,
      );
      expect(res.status).toBe(403);
    });

    it("404 when the profile does not exist", async () => {
      const res = await authed(request(app).get("/api/payroll-profiles/ghost-1"));
      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    });
  });

  // ---- PUT ----------------------------------------------------------------

  describe("PUT /:employeeId", () => {
    it("401 without auth", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await request(app)
        .put("/api/payroll-profiles/emp-1")
        .send({
          bankAccountNumber: "0987654321",
          bankName: "New Bank",
          baseSalary: 6000,
        });
      expect(res.status).toBe(401);
    });

    it("403 for a Line Manager", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
        managerToken,
      ).send({
        bankAccountNumber: "0987654321",
        bankName: "New Bank",
        baseSalary: 6000,
      });
      expect(res.status).toBe(403);
    });

    it("403 for an Employee", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
        empToken,
      ).send({
        bankAccountNumber: "0987654321",
        bankName: "New Bank",
        baseSalary: 6000,
      });
      expect(res.status).toBe(403);
    });

    it("200 for HR Admin and persists the new values", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", {
        bankAccountNumber: "OLD",
        bankName: "Old Bank",
        baseSalary: 4000,
      });
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "NEW-ACC",
        bankName: "New Bank",
        baseSalary: 4500,
      });

      expect(res.status).toBe(200);
      expect(res.body.profile).toMatchObject({
        employeeId: "emp-1",
        bankAccountNumber: "NEW-ACC",
        bankName: "New Bank",
        baseSalary: 4500,
      });

      const doc = await db.collection("payrollProfiles").doc("emp-1").get();
      expect(doc.data()?.baseSalary).toBe(4500);
    });

    it("preserves createdAt and refreshes updatedAt on update", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", { baseSalary: 5000 });
      const before = await authed(request(app).get("/api/payroll-profiles/emp-1"));
      const originalCreatedAt = before.body.profile.createdAt;
      expect(originalCreatedAt).toBe("2026-01-01T00:00:00.000Z");

      const res = await authed(request(app).put("/api/payroll-profiles/emp-1")).send({
        bankAccountNumber: "1234567890",
        bankName: "Test Bank",
        baseSalary: 6000,
      });
      expect(res.status).toBe(200);
      expect(res.body.profile.createdAt).toBe(originalCreatedAt);
      expect(typeof res.body.profile.updatedAt).toBe("string");
    });

    it("404 when the profile does not exist", async () => {
      await seedEmployee("emp-1");
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "0987654321",
        bankName: "New Bank",
        baseSalary: 6000,
      });
      expect(res.status).toBe(404);
    });

    it("400 when a business field is missing or invalid", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1");
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "0987654321",
        bankName: "New Bank",
        baseSalary: "not-a-number",
      });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_BASE_SALARY");
    });

    it("writes a payroll_profile.update audit entry with a field-level diff", async () => {
      await seedEmployee("emp-1");
      await seedProfile("emp-1", {
        bankAccountNumber: "OLD",
        bankName: "Old Bank",
        baseSalary: 4000,
      });
      const res = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "NEW",
        bankName: "New Bank",
        baseSalary: 4500,
      });
      expect(res.status).toBe(200);

      const updates = await auditEntries("payroll_profile.update");
      expect(updates).toHaveLength(1);
      expect(updates[0]).toMatchObject({
        actorId: "admin-1",
        targetType: "PayrollProfile",
        targetId: "emp-1",
      });
      expect(updates[0].diff).toEqual({
        bankAccountNumber: { before: "OLD", after: "NEW" },
        bankName: { before: "Old Bank", after: "New Bank" },
        baseSalary: { before: 4000, after: 4500 },
      });
    });

    it("regression: a salary update only changes the profile and writes a focused audit diff", async () => {
      await seedEmployee("emp-1");
      const createRes = await authed(request(app).post("/api/payroll-profiles")).send(
        validBody,
      );
      expect(createRes.status).toBe(201);

      // A historical payslip snapshots the old salary (Ticket 11 shape).
      await seedPayslip("emp-1", "2026-06", 5000);

      const updateRes = await authed(
        request(app).put("/api/payroll-profiles/emp-1"),
      ).send({
        bankAccountNumber: "1234567890",
        bankName: "Test Bank",
        baseSalary: 6000,
      });
      expect(updateRes.status).toBe(200);
      expect(updateRes.body.profile.baseSalary).toBe(6000);

      // The historical payslip keeps its own snapshot — untouched by the update.
      const payslipDoc = await db.doc("payrollProfiles/emp-1/payslips/2026-06").get();
      expect(payslipDoc.exists).toBe(true);
      expect(payslipDoc.data()?.baseSalary).toBe(5000);

      // The audit diff covers only the salary change — no system/identity fields.
      const updates = await auditEntries("payroll_profile.update");
      expect(updates).toHaveLength(1);
      expect(updates[0].diff).toEqual({
        baseSalary: { before: 5000, after: 6000 },
      });
    });
  });
});
