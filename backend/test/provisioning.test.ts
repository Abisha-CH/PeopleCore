import { describe, it, expect, beforeEach, vi } from "vitest";
import request from "supertest";

vi.mock("../src/config/firebase", async () => await import("./helpers/firebase-mock"));

import { createApp } from "../src/app";
import {
  makeToken,
  resetMock,
  createdUsers,
  db,
} from "./helpers/firebase-mock";
import { provisionEmployee } from "../src/services/provisioning";

const app = createApp();
const adminToken = makeToken("admin-1", "admin");

const baseEmployee = {
  fullName: "Test User",
  email: "default@test.com",
  password: "secret123",
  phone: "+234-800-000-0001",
  department: "Engineering",
  jobTitle: "Software Engineer",
  employmentRole: "full-time",
  startDate: "2024-01-15",
  status: "active",
  nationalId: "NID-TEST-001",
  address: "12 Main Street, Lagos",
};

beforeEach(() => {
  resetMock();
});

async function createEmployee(overrides: Record<string, unknown> = {}) {
  return request(app)
    .post("/api/employees")
    .set("Authorization", `Bearer ${adminToken}`)
    .send({ ...baseEmployee, ...overrides });
}

// ---------------------------------------------------------------------------
// Manager provisioning E2E (Issue 1)
// ---------------------------------------------------------------------------

describe("Manager provisioning", () => {
  it("creates BOTH an auth account with manager claim AND an employee document", async () => {
    const res = await createEmployee({ email: "mgr@test.com", role: "manager" });
    expect(res.status).toBe(201);

    const managerId = res.body.employee.employeeId;
    expect(managerId).toEqual(expect.any(String));

    // 1. Firebase Auth custom claim is "manager"
    const user = createdUsers.find((u) => u.uid === managerId);
    expect(user?.claims).toEqual({ role: "manager" });

    // 2. Employee document is persisted and readable
    const getRes = await request(app)
      .get(`/api/employees/${managerId}`)
      .set("Authorization", `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.employee.fullName).toBe("Test User");

    // 3. Employee document does NOT leak a "role" field (schema unchanged)
    expect(getRes.body.employee).not.toHaveProperty("role");
  });

  it("manager claim is honoured end-to-end via the dashboard endpoint", async () => {
    const res = await createEmployee({ email: "mgr-dash@test.com", role: "manager" });
    const managerId = res.body.employee.employeeId;
    const managerToken = makeToken(managerId, "manager");

    const dashRes = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${managerToken}`);

    expect(dashRes.status).toBe(200);
    expect(dashRes.body.dashboard).toHaveProperty("pendingDirectReportLeaveCount", 0);
  });

  it("contrast: auth-only manager (create-account) gets 404 on dashboard (no employee doc)", async () => {
    // create-account provisions Auth but NOT an Employee document.
    await request(app)
      .post("/api/auth/create-account")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ email: "auth-only@test.com", password: "secret123", role: "manager" });

    const user = createdUsers.find((u) => u.email === "auth-only@test.com");
    expect(user?.claims).toEqual({ role: "manager" });

    const managerToken = makeToken(user!.uid, "manager");
    const dashRes = await request(app)
      .get("/api/dashboard")
      .set("Authorization", `Bearer ${managerToken}`);

    // Dashboard fetches the employee record first → 404 when missing
    expect(dashRes.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// Default role + validation
// ---------------------------------------------------------------------------

describe("Role handling", () => {
  it("defaults to employee claim when role is omitted", async () => {
    const res = await createEmployee({ email: "emp-default@test.com" });
    expect(res.status).toBe(201);

    const empId = res.body.employee.employeeId;
    const user = createdUsers.find((u) => u.uid === empId);
    expect(user?.claims).toEqual({ role: "employee" });
  });

  it("explicitly provisioned employee gets employee claim", async () => {
    const res = await createEmployee({ email: "emp-explicit@test.com", role: "employee" });
    expect(res.status).toBe(201);

    const empId = res.body.employee.employeeId;
    const user = createdUsers.find((u) => u.uid === empId);
    expect(user?.claims).toEqual({ role: "employee" });
  });

  it("rejects role=admin with 400 INVALID_ROLE", async () => {
    const res = await createEmployee({ email: "admin@test.com", role: "admin" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ROLE");
  });

  it("rejects arbitrary role strings with 400 INVALID_ROLE", async () => {
    const res = await createEmployee({ email: "bad@test.com", role: "superadmin" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ROLE");
  });

  it("rejects non-string role values with 400 INVALID_ROLE", async () => {
    const res = await createEmployee({ email: "bad2@test.com", role: 123 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_ROLE");
  });

  it("provisioned manager is usable as lineManagerId", async () => {
    const mgrRes = await createEmployee({ email: "lm-mgr@test.com", role: "manager" });
    const managerUid = mgrRes.body.employee.employeeId;

    const empRes = await createEmployee({ email: "report@test.com", lineManagerId: managerUid });
    expect(empRes.status).toBe(201);
    expect(empRes.body.employee.lineManagerId).toBe(managerUid);
  });
});

// ---------------------------------------------------------------------------
// Rollback
// ---------------------------------------------------------------------------

describe("Compensating rollback", () => {
  it("deletes the auth user when the employee document write fails", async () => {
    // Intercept db.collection("employees") to make the set() call throw,
    // simulating a Firestore write failure during provisioning.
    const realCollection = db.collection.bind(db);
    const spy = vi.spyOn(db, "collection").mockImplementation((path: string) => {
      const ref = realCollection(path);
      if (path === "employees") {
        const originalDoc = ref.doc.bind(ref);
        (ref as any).doc = ((id?: string) => {
          const docRef = originalDoc(id);
          (docRef as any).set = async () => {
            throw new Error("simulated write failure");
          };
          return docRef;
        }) as typeof ref.doc;
      }
      return ref;
    });

    await expect(
      provisionEmployee({
        fullName: "Rollback User",
        email: "rollback@test.com",
        password: "secret123",
        phone: "+234-000",
        department: "Test",
        jobTitle: "Tester",
        employmentRole: "full-time",
        startDate: "2024-01-01",
        status: "active",
        nationalId: "NID-ROLLBACK",
        address: "Nowhere",
      }),
    ).rejects.toThrow("simulated write failure");

    spy.mockRestore();

    // Auth user was cleaned up by the rollback — no orphan account remains.
    expect(createdUsers).toHaveLength(0);
  });
});
