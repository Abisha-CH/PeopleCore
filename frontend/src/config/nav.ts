import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Settings2,
  Wallet,
  ScrollText,
  ClipboardCheck,
  CalendarCheck,
  UserRound,
  ReceiptText,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@/lib/auth";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

// spec §2.1: nav sections per role
export const NAV_BY_ROLE: Record<Role, NavSection[]> = {
  admin: [
    {
      title: "Overview",
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "People",
      items: [{ label: "Employees", href: "/employees", icon: Users }],
    },
    {
      title: "Leave",
      items: [
        { label: "Leave Management", href: "/leave", icon: CalendarDays },
        { label: "Leave Settings", href: "/leave-settings", icon: Settings2 },
      ],
    },
    {
      title: "Payroll",
      items: [{ label: "Payroll", href: "/payroll", icon: Wallet }],
    },
    {
      title: "System",
      items: [{ label: "Audit Log", href: "/audit-log", icon: ScrollText }],
    },
  ],
  manager: [
    {
      title: "Overview",
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Leave",
      items: [
        { label: "Leave Approvals", href: "/leave-approvals", icon: ClipboardCheck },
        { label: "My Leave", href: "/my-leave", icon: CalendarCheck },
      ],
    },
    {
      title: "Account",
      items: [
        { label: "My Profile", href: "/my-profile", icon: UserRound },
        { label: "My Payslips", href: "/my-payslips", icon: ReceiptText },
      ],
    },
  ],
  employee: [
    {
      title: "Overview",
      items: [{ label: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
    },
    {
      title: "Leave",
      items: [{ label: "My Leave", href: "/my-leave", icon: CalendarCheck }],
    },
    {
      title: "Account",
      items: [
        { label: "My Profile", href: "/my-profile", icon: UserRound },
        { label: "My Payslips", href: "/my-payslips", icon: ReceiptText },
      ],
    },
  ],
};

// Simple page title mapping from route path
export const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/leave": "Leave Management",
  "/leave-settings": "Leave Settings",
  "/payroll": "Payroll",
  "/audit-log": "Audit Log",
  "/leave-approvals": "Leave Approvals",
  "/my-leave": "My Leave",
  "/my-profile": "My Profile",
  "/my-payslips": "My Payslips",
};
