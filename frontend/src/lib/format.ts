/*
 * Formatting helpers shared across pages. Kept locale-aware where the Intl
 * API makes that free, falling back to simple implementations for initials.
 */

/**
 * Human-readable line manager label. Never renders a raw ID: resolved names
 * come from the API (`lineManagerName`); a broken reference degrades to
 * "Manager unavailable", and no assignment to "No manager assigned".
 */
export function lineManagerLabel(employee: {
  lineManagerId?: string;
  lineManagerName?: string;
}): string {
  if (employee.lineManagerName) return employee.lineManagerName;
  if (employee.lineManagerId) return "Manager unavailable";
  return "No manager assigned";
}

/** "Alice Johnson" → "AJ"; single names → first two letters. */
export function getInitials(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});

/** "$2,500.00" */
export function formatCurrency(amount: number): string {
  return currencyFormatter.format(amount);
}

const compactCurrencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "$2.5K" / "$1.2M" — for stat cards. */
export function formatCurrencyCompact(amount: number): string {
  return compactCurrencyFormatter.format(amount);
}

/** "2026-08-07" → "Aug 7, 2026" */
export function formatDate(
  isoDate: string | undefined | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!isoDate) return "—";
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    ...options,
  });
}

/** Two dates → "Aug 7 – 9, 2026" (or "Aug 7, 2026" when single-day). */
export function formatDateRange(
  start: string | undefined | null,
  end: string | undefined | null,
  isHalfDay?: boolean,
): string {
  if (!start) return "—";
  if (start === end || !end) return formatDate(start);
  return `${formatDate(start, { month: "short", day: "numeric" })} – ${formatDate(
    end,
  )}${isHalfDay ? " (half day)" : ""}`;
}

/** ISO timestamp → "Aug 7, 2026, 3:24 PM" */
export function formatDateTime(
  iso: string | undefined | null,
): string {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export function monthName(month: number): string {
  return MONTHS[month - 1] ?? String(month);
}

/** "Jan 2026" — for payslip periods. */
export function monthYearLabel(month: number, year: number): string {
  return `${monthName(month).slice(0, 3)} ${year}`;
}

/** "payslip.publish" → "Payslip · Publish"; falls back to the raw action. */
export function formatAuditAction(action: string): string {
  const [entity, verb] = action.split(".");
  if (!verb) return action;
  const humanize = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return `${humanize(entity)} · ${humanize(verb)}`;
}

/** "daysPerYear" → "Days Per Year"; "bank_account_number" → "Bank Account Number". */
export function humanizeField(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
