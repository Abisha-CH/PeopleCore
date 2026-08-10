import cors from "cors";
import express from "express";
import { authRouter } from "./routes/auth";
import { auditLogRouter } from "./routes/audit-log";
import { employeesRouter } from "./routes/employees";
import { leaveEntitlementsRouter } from "./routes/leave-entitlements";
import { leaveTypesRouter } from "./routes/leave-types";
import { employeeLeaveEntitlementsRouter } from "./routes/employee-leave-entitlements";
import { publicHolidaysRouter } from "./routes/public-holidays";
import { leaveRequestsRouter } from "./routes/leave-requests";
import { payrollProfilesRouter } from "./routes/payroll-profiles";
import { payslipsRouter } from "./routes/payslips";
import { dashboardRouter } from "./routes/dashboard";
import { seedRouter } from "./routes/seed";
import { errorHandler, notFound } from "./middleware/errors";

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(cors());
  app.use(express.json());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.use("/api/auth", authRouter);
  app.use("/api/audit-log", auditLogRouter);
  app.use("/api/employees", employeesRouter);
  app.use("/api/seed", seedRouter);
  app.use("/api/leave-types", leaveTypesRouter);
  app.use("/api/leave-entitlements", leaveEntitlementsRouter);
  app.use("/api/employee-leave-entitlements", employeeLeaveEntitlementsRouter);
  app.use("/api/public-holidays", publicHolidaysRouter);
  app.use("/api/leave-requests", leaveRequestsRouter);
  app.use("/api/payroll-profiles", payrollProfilesRouter);
  app.use("/api/payslips", payslipsRouter);
  app.use("/api/dashboard", dashboardRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
