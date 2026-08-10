import { db } from "../config/firebase";

/**
 * Computes `numberOfDays` at submission time (LEAVE-08).
 *
 * Half-day requests are always `0.5`. Full-day requests count the weekdays
 * (Mon–Fri) between `startDate` and `endDate` inclusive, excluding any public
 * holiday whose date falls on a weekday within that range (C-07).
 *
 * Dates are compared using UTC so the weekday math is timezone-independent.
 */
export function computeNumberOfDays(
  startDate: string,
  endDate: string,
  isHalfDay: boolean,
  holidayDates: ReadonlySet<string>,
): number {
  if (isHalfDay) return 0.5;

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const cursor = new Date(start);
  let days = 0;

  while (cursor <= end) {
    const dayOfWeek = cursor.getUTCDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const key = cursor.toISOString().slice(0, 10);
      if (!holidayDates.has(key)) {
        days += 1;
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return days;
}

/**
 * Loads every configured public holiday date into a set keyed by `YYYY-MM-DD`.
 * The holiday count is small (workshop scale), so a full scan is acceptable.
 */
export async function fetchHolidayDates(): Promise<Set<string>> {
  const snap = await db.collection("publicHolidays").get();
  const dates = new Set<string>();
  for (const doc of snap.docs) {
    const date = doc.data()?.date as string | undefined;
    if (typeof date === "string") dates.add(date);
  }
  return dates;
}

/**
 * Resolves an employee's effective annual entitlement for a capped leave type:
 * the per-employee override wins over the company-wide default (C-04, LEAVE-17).
 *
 * Returns `null` when neither an override nor a company entitlement exists —
 * the caller decides whether that is a hard error.
 */
export async function fetchEffectiveEntitlement(
  employeeId: string,
  leaveTypeId: string,
): Promise<number | null> {
  const overrideDoc = await db
    .collection("employeeLeaveEntitlements")
    .doc(`${employeeId}_${leaveTypeId}`)
    .get();
  if (overrideDoc.exists) {
    return overrideDoc.data()?.daysPerYear as number;
  }

  const companyDoc = await db
    .collection("leaveEntitlements")
    .doc(leaveTypeId)
    .get();
  if (companyDoc.exists) {
    return companyDoc.data()?.daysPerYear as number;
  }

  return null;
}

/**
 * Sums the `numberOfDays` an employee has already committed against a leave
 * type in a given year. Requests that consume no leave (cancelled, rejected)
 * are excluded; anything still active — `pending`, `manager_approved`, or
 * `approved` — counts toward the allowance so over-booking is prevented.
 *
 * A request's year is taken from its `startDate`.
 */
export async function computeUsedDays(
  employeeId: string,
  leaveTypeId: string,
  year: number,
): Promise<number> {
  const snap = await db
    .collection("leaveRequests")
    .where("employeeId", "==", employeeId)
    .get();
  let used = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data) continue;
    if (data.leaveTypeId !== leaveTypeId) continue;

    const status = data.status as string;
    if (status === "cancelled" || status === "rejected") continue;

    const startYear = Number(String(data.startDate).slice(0, 4));
    if (startYear !== year) continue;

    used += data.numberOfDays as number;
  }

  return used;
}

/**
 * Detects whether the employee already has an active request that overlaps the
 * requested range. Cancelled and rejected requests do not block new ones.
 */
export async function hasOverlappingRequest(
  employeeId: string,
  startDate: string,
  endDate: string,
): Promise<boolean> {
  const snap = await db
    .collection("leaveRequests")
    .where("employeeId", "==", employeeId)
    .get();

  for (const doc of snap.docs) {
    const data = doc.data();
    if (!data) continue;

    const status = data.status as string;
    if (status === "cancelled" || status === "rejected") continue;

    const existingStart = data.startDate as string;
    const existingEnd = data.endDate as string;
    // Ranges [startDate, endDate] and [existingStart, existingEnd] overlap iff
    // startDate <= existingEnd && endDate >= existingStart. Lexicographic
    // comparison is chronological for fixed-width YYYY-MM-DD strings.
    if (startDate <= existingEnd && endDate >= existingStart) {
      return true;
    }
  }

  return false;
}
