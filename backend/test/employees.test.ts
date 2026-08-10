import { describe, it, expect, beforeEach } from "vitest";
import { vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () => await import("./helpers/firebase-mock"));

import { createApp } from "../src/app";
import {
  makeToken,
  resetMock,
  createdUsers,
} from "./helpers/firebase-mock";

const app = createApp();
const adminToken = makeToken("admin-1", "admin");
const managerToken = makeToken("manager-1", "manager");
const employeeToken = makeToken("employee-1", "employee");

const baseEmployee = {
  fullName: "Alice Adeyemi",
  email: "alice@example.com",
  password: "secret123",
  phone: "+234-800-000-0001",
  department: "Engineering",
  jobTitle: "Software Engineer",
  employmentRole: "full-time",
  startDate: "2024-01-15",
  status: "active",
  nationalId: "NID-ALICE-001",
  address: "12 Main Street, Lagos",
  emergencyContact: {
    name: "Bob Adeyemi",
    phone: "+234-800-000-0002",
    relationship: "Spouse",
  },
};

beforeEach(() => {
  resetMock();
});

// ---- helpers ---------------------------------------------------------------

async function create(overrides: Record<string, unknown> = {}) {
  const res = await request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...baseEmployee, ...overrides });
  return res;
}

// ---- POST /api/employees ---------------------------------------------------

describe("POST /api/employees", () => {
  it("creates an employee with all fields and sets employeeId = Firebase UID", async () => {
    const res = await create();

    expect(res.status).toBe(201);
    expect(res.body.employee).toMatchObject({
      fullName: "Alice Adeyemi",
      email: "alice@example.com",
      phone: "+234-800-000-0001",
      department: "Engineering",
      jobTitle: "Software Engineer",
      employmentRole: "full-time",
      startDate: "2024-01-15",
      status: "active",
      nationalId: "NID-ALICE-001",
      address: "12 Main Street, Lagos",
      emergencyContact: {
        name: "Bob Adeyemi",
        phone: "+234-800-000-0002",
        relationship: "Spouse",
      },
    });
    expect(res.body.employee.employeeId).toEqual(expect.any(String));
    expect(res.body.employee).not.toHaveProperty("password");

    const created = createdUsers.find(
      (u) => u.uid === res.body.employee.employeeId,
    );
    expect(created?.claims).toEqual({ role: "employee" });
  });

  it("creates an employee without optional fields (no lineManagerId, no emergencyContact) — guards against Firestore rejecting undefined values", async () => {
    const minimalPayload = {
      fullName: "Minimal User",
      email: "minimal@example.com",
      password: "secret123",
      phone: "+1-000-000-0000",
      department: "QA",
      jobTitle: "Tester",
      employmentRole: "full-time",
      startDate: "2025-01-01",
      status: "active",
      nationalId: "NID-MIN-001",
      address: "1 Test Lane",
    };
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(minimalPayload);

    expect(res.status).toBe(201);
    expect(res.body.employee.fullName).toBe("Minimal User");
    expect(res.body.employee.employeeId).toEqual(expect.any(String));
    // The employee record should NOT contain any `undefined` keys — real
    // Firestore throws "Cannot use 'undefined' as a Firestore value" when
    // ignoreUndefinedProperties is not enabled (the default).
    const record = res.body.employee;
    for (const key of Object.keys(record)) {
      expect(record[key]).not.toBeUndefined();
    }
  });

  it("writes an audit log entry for employee.create", async () => {
    const createRes = await create();
    expect(createRes.status).toBe(201);
    const employeeId = createRes.body.employee.employeeId;

    const auditRes = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(auditRes.status).toBe(200);
    const entry = auditRes.body.entries.find(
      (e: { targetId: string }) => e.targetId === employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry).toMatchObject({
      actorId: "admin-1",
      actorRole: "admin",
      action: "employee.create",
      targetType: "Employee",
      targetId: employeeId,
    });
  });

  it("rejects invalid employmentRole", async () => {
    const res = await create({ employmentRole: "freelance" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_EMPLOYMENT_ROLE");
  });

  it("rejects invalid status", async () => {
    const res = await create({ status: "retired" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_STATUS");
  });

  it("returns 409 for a duplicate email", async () => {
    await create();
    const res = await create({ phone: "+234-999" });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_IN_USE");
  });

  it("allows a manager as lineManagerId only if the claim role is manager", async () => {
    createdUsers.push({
      uid: "lm-1",
      email: "lm1@example.com",
      claims: { role: "manager" },
    });
    const res = await create({ email: "alice2@example.com", lineManagerId: "lm-1" });
    expect(res.status).toBe(201);
    expect(res.body.employee.lineManagerId).toBe("lm-1");
  });

  it("rejects a lineManagerId that does not have the manager role", async () => {
    createdUsers.push({
      uid: "emp-2",
      email: "emp2@example.com",
      claims: { role: "employee" },
    });
    const res = await create({ email: "alice3@example.com", lineManagerId: "emp-2" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_LINE_MANAGER");
  });

  it("rejects a lineManagerId that does not exist", async () => {
    const res = await create({ email: "alice4@example.com", lineManagerId: "nonexistent" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_LINE_MANAGER");
  });

  it("returns 403 when a manager tries to create an employee", async () => {
    const res = await request(app)
      .post("/api/employees")
      .set("Authorization", `Bearer ${managerToken}`)
      .send(baseEmployee);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 without a token", async () => {
    const res = await request(app).post("/api/employees").send(baseEmployee);
    expect(res.status).toBe(401);
  });
});

// ---- GET /api/employees ----------------------------------------------------

describe("GET /api/employees", () => {
  it("lists all employees as HR Admin", async () => {
    await create();
    await create({ email: "bob@example.com", fullName: "Bob B.", department: "Sales", phone: "+234-000" });
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(2);
    expect(res.body.employees).toHaveLength(2);
  });

  it("filters by status", async () => {
    await create();
    const res = await request(app)
      .get("/api/employees?status=inactive")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });

  it("filters by department", async () => {
    await create();
    await create({ email: "bob@example.com", department: "Sales", phone: "+234-000" });
    const res = await request(app)
      .get("/api/employees?department=Engineering")
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.employees[0].department).toBe("Engineering");
  });

  it("returns 403 for employees", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 200 for managers (scoped to direct reports + self)", async () => {
    const res = await request(app)
      .get("/api/employees")
      .set("Authorization", `Bearer ${managerToken}`);
    expect(res.status).toBe(200);
  });
});

// ---- GET /api/employees/:id ------------------------------------------------

describe("GET /api/employees/:id", () => {
  it("lets HR Admin read any employee", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee.fullName).toBe("Alice Adeyemi");
  });

  it("lets an employee read their own record", async () => {
    const created = (await create()).body.employee;
    const ownToken = makeToken(created.employeeId, "employee");
    const res = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${ownToken}`);
    expect(res.status).toBe(200);
    expect(res.body.employee.fullName).toBe("Alice Adeyemi");
  });

  it("returns 403 when an employee reads another employee's record", async () => {
    const created = (await create()).body.employee;
    // employeeToken is for uid employee-1, not the created uid
    const res = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("lets a line manager read their own record", async () => {
    const created = (await create()).body.employee;
    const ownToken = makeToken(created.employeeId, "manager");
    const res = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${ownToken}`);
    expect(res.status).toBe(200);
  });

  it("returns 404 for a missing employee", async () => {
    const res = await request(app)
      .get("/api/employees/nonexistent")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("NOT_FOUND");
  });
});

// ---- PUT /api/employees/:id ------------------------------------------------

describe("PUT /api/employees/:id", () => {
  const updatePayload = {
    fullName: "Alice A.",
    email: "alice2@example.com",
    phone: "+234-111-1111",
    department: "Platform",
    jobTitle: "Senior Engineer",
    employmentRole: "contract",
    startDate: "2023-06-01",
    status: "inactive",
    nationalId: "NID-ALICE-002",
    address: "45 New Road, Lagos",
    emergencyContact: { name: "Carol", phone: "+234-222", relationship: "Sister" },
  };

  it("updates all fields as HR Admin", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .put(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(updatePayload);

    expect(res.status).toBe(200);
    expect(res.body.employee).toMatchObject({
      fullName: "Alice A.",
      email: "alice2@example.com",
      department: "Platform",
      employmentRole: "contract",
      status: "inactive",
    });

    // Confirm persisted
    const getRes = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.body.employee.jobTitle).toBe("Senior Engineer");
  });

  it("writes an audit entry with a diff", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .put(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`)
      .send(updatePayload);
    expect(res.status).toBe(200);

    const auditRes = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);

    const entry = auditRes.body.entries.find(
      (e: { action: string; targetId: string }) =>
        e.action === "employee.update" && e.targetId === created.employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry.diff.department).toEqual({
      before: "Engineering",
      after: "Platform",
    });
  });

  it("returns 404 when updating a missing employee", async () => {
    const res = await request(app)
      .put("/api/employees/nonexistent")
      .set("Authorization", `Bearer ${adminToken}`)
      .send(updatePayload);
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin roles", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .put(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${managerToken}`)
      .send(updatePayload);
    expect(res.status).toBe(403);
  });
});

// ---- DELETE /api/employees/:id ---------------------------------------------

describe("DELETE /api/employees/:id", () => {
  it("soft-deletes by setting status to inactive", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .delete(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.employee.status).toBe("inactive");

    // Record still exists and is still readable
    const getRes = await request(app)
      .get(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.employee.status).toBe("inactive");

    // Not hard-deleted from Firebase Auth either
    expect(createdUsers.find((u) => u.uid === created.employeeId)).toBeDefined();
  });

  it("writes an audit entry for employee.delete with status diff", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .delete(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(200);

    const auditRes = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = auditRes.body.entries.find(
      (e: { action: string; targetId: string }) =>
        e.action === "employee.delete" && e.targetId === created.employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry.diff.status).toEqual({ before: "active", after: "inactive" });
  });

  it("is idempotent when already inactive", async () => {
    const created = (await create()).body.employee;
    await request(app)
      .delete(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    const second = await request(app)
      .delete(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(second.status).toBe(200);
    expect(second.body.employee.status).toBe("inactive");
  });

  it("returns 404 for a missing employee", async () => {
    const res = await request(app)
      .delete("/api/employees/nonexistent")
      .set("Authorization", `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it("returns 403 for non-admin roles", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .delete(`/api/employees/${created.employeeId}`)
      .set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });
});

// ---- PATCH /api/employees/:id/phone ----------------------------------------

describe("PATCH /api/employees/:id/phone", () => {
  it("lets an employee update their own phone number", async () => {
    const created = (await create()).body.employee;
    const ownToken = makeToken(created.employeeId, "employee");

    const res = await request(app)
      .patch(`/api/employees/${created.employeeId}/phone`)
      .set("Authorization", `Bearer ${ownToken}`)
      .send({ phone: "+234-999-9999" });

    expect(res.status).toBe(200);
    expect(res.body.employee.phone).toBe("+234-999-9999");
  });

  it("returns 403 when updating another employee's phone", async () => {
    const created = (await create()).body.employee;
    const res = await request(app)
      .patch(`/api/employees/${created.employeeId}/phone`)
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ phone: "+234-000" });
    expect(res.status).toBe(403);
  });

  it("returns 403 when the body contains fields other than phone", async () => {
    const created = (await create()).body.employee;
    const ownToken = makeToken(created.employeeId, "employee");

    const res = await request(app)
      .patch(`/api/employees/${created.employeeId}/phone`)
      .set("Authorization", `Bearer ${ownToken}`)
      .send({ phone: "+234-000", fullName: "Hacked" });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("writes an audit entry for the phone update", async () => {
    const created = (await create()).body.employee;
    const ownToken = makeToken(created.employeeId, "employee");

    const res = await request(app)
      .patch(`/api/employees/${created.employeeId}/phone`)
      .set("Authorization", `Bearer ${ownToken}`)
      .send({ phone: "+234-888-8888" });
    expect(res.status).toBe(200);

    const auditRes = await request(app)
      .get("/api/audit-log")
      .set("Authorization", `Bearer ${adminToken}`);
    const entry = auditRes.body.entries.find(
      (e: { action: string; targetId: string }) =>
        e.action === "employee.update" && e.targetId === created.employeeId,
    );
    expect(entry).toBeDefined();
    expect(entry.diff.phone).toEqual({
      before: "+234-800-000-0001",
      after: "+234-888-8888",
    });
  });
});
