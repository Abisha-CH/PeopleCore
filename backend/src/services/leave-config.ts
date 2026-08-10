import { db } from "../config/firebase";
import { AppError } from "../errors";
import type { LeaveType } from "../types";

function toLeaveType(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}): LeaveType | null {
  const data = doc.data();
  if (!data) return null;

  return {
    leaveTypeId: doc.id,
    name: data.name as string,
    isCapped: data.isCapped as boolean,
    defaultDaysPerYear: data.defaultDaysPerYear as number,
  };
}

export async function fetchLeaveType(id: string): Promise<LeaveType> {
  const doc = await db.collection("leaveTypes").doc(id).get();
  if (!doc.exists) {
    throw new AppError(404, "NOT_FOUND", "Leave type not found.");
  }
  const lt = toLeaveType(doc);
  if (!lt) {
    throw new AppError(404, "NOT_FOUND", "Leave type not found.");
  }
  return lt;
}

export async function assertCappedLeaveType(id: string): Promise<LeaveType> {
  const lt = await fetchLeaveType(id);
  if (!lt.isCapped) {
    throw new AppError(
      400,
      "UNCAPPED_LEAVE_TYPE",
      "Leave entitlements only apply to capped leave types.",
    );
  }
  return lt;
}
