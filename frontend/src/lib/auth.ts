export const ROLES = ["admin", "manager", "employee"] as const;
export type Role = (typeof ROLES)[number];

export function isValidRole(v: unknown): v is Role {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v as Role);
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: "HR Admin",
  manager: "Line Manager",
  employee: "Employee",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  admin: "Manage employees, leave, payroll, and workspace settings.",
  manager: "Review and approve your team's leave requests.",
  employee: "Request leave, view payslips, and manage your profile.",
};
