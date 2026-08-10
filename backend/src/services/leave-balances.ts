import { db } from "../config/firebase";
import type { LeaveBalance } from "../types";

/**
 * Mirrors Ticket 06's usage rule (see `computeUsedDays` in leave-requests.ts):
 * a request that is still active — `pending`, `manager_approved`, or
 * `approved` — counts toward the allowance for the year of its `startDate`;
 * cancelled and rejected requests consume no leave.
 */
function countsTowardBalance(status: string): boolean {
  return status !== "cancelled" && status !== "rejected";
}

/**
 * Computes the current balance for every capped leave type an employee can draw
 * on, using the same entitlement resolution as Ticket 06 (C-04, LEAVE-17): the
 * per-employee override wins over the company-wide default, and capped types
 * with no configured entitlement are omitted.
 *
 * Implemented as a single pass over the four relevant collections rather than
 * one entitlement lookup plus one used-days scan per type, so the cost stays
 * flat as the number of capped leave types grows.
 */
export async function computeLeaveBalances(
  employeeId: string,
  year: number,
): Promise<LeaveBalance[]> {
  // 1. Company-wide defaults, keyed by leave type id.
  const companySnap = await db.collection("leaveEntitlements").get();
  const companyDays = new Map<string, number>();
  for (const doc of companySnap.docs) {
    const days = doc.data()?.daysPerYear;
    if (typeof days === "number") companyDays.set(doc.id, days);
  }

  // 2. Per-employee overrides, keyed by leave type id.
  const overrideSnap = await db
    .collection("employeeLeaveEntitlements")
    .where("employeeId", "==", employeeId)
    .get();
  const overrideDays = new Map<string, number>();
  for (const doc of overrideSnap.docs) {
    const data = doc.data();
    if (!data) continue;
    const days = data.daysPerYear;
    if (typeof days === "number") {
      overrideDays.set(data.leaveTypeId as string, days);
    }
  }

  // 3. Only capped leave types carry a balance.
  const typesSnap = await db.collection("leaveTypes").get();
  const cappedTypes = typesSnap.docs
    .map((d) => {
      const data = d.data() ?? {};
      return {
        id: d.id,
        name: data.name as string,
        isCapped: data.isCapped as boolean,
      };
    })
    .filter((t) => t.isCapped === true);

  // 4. One scan of the employee's requests builds used days per type.
  const requestsSnap = await db
    .collection("leaveRequests")
    .where("employeeId", "==", employeeId)
    .get();
  const usedByType = new Map<string, number>();
  for (const doc of requestsSnap.docs) {
    const data = doc.data();
    if (!data) continue;
    if (!countsTowardBalance(data.status as string)) continue;
    const startYear = Number(String(data.startDate).slice(0, 4));
    if (startYear !== year) continue;
    const leaveTypeId = data.leaveTypeId as string;
    usedByType.set(
      leaveTypeId,
      (usedByType.get(leaveTypeId) ?? 0) + (data.numberOfDays as number),
    );
  }

  const balances: LeaveBalance[] = [];
  for (const type of cappedTypes) {
    const effectiveDays = overrideDays.get(type.id) ?? companyDays.get(type.id);
    if (effectiveDays === undefined) continue; // no entitlement configured
    balances.push({
      leaveTypeId: type.id,
      name: type.name as string,
      balance: effectiveDays - (usedByType.get(type.id) ?? 0),
    });
  }
  return balances;
}
