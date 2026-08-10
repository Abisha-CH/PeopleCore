import { AppError } from "../errors";
import { HALF_DAY_PERIODS, isLeaveRequestStatus } from "../types";
import type { HalfDayPeriod } from "../types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// ---- internal helpers -------------------------------------------------------

function requiredString(
  value: unknown,
  code: string,
  message: string,
): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new AppError(400, code, message);
  }
  return value.trim();
}

function validDate(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !DATE_RE.test(value) ||
    Number.isNaN(new Date(value).getTime())
  ) {
    throw new AppError(
      400,
      "INVALID_DATE",
      `${field} must be a valid YYYY-MM-DD date.`,
    );
  }
  return value;
}

// ---- public API -------------------------------------------------------------

export interface LeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  isHalfDay: boolean;
  halfDayPeriod?: HalfDayPeriod;
}

/**
 * Validates and normalises input for a new leave request.
 *
 * Rules (per Ticket 05 — submission validation):
 *  - `leaveTypeId`, `reason` are required, non-empty.
 *  - `startDate`/`endDate` must be valid `YYYY-MM-DD` dates.
 *  - `isHalfDay` is optional and defaults to `false`; when present it must be
 *    a boolean.
 *  - Half-day requests require `halfDayPeriod` (`morning`|`afternoon`) and
 *    `startDate === endDate`.
 *  - Full-day requests require `startDate <= endDate`.
 *
 * All validation failures surface as HTTP 400.
 */
export function validateLeaveRequestInput(
  input: Record<string, unknown>,
): LeaveRequestInput {
  const leaveTypeId = requiredString(
    input.leaveTypeId,
    "INVALID_LEAVE_TYPE_ID",
    "leaveTypeId is required.",
  );
  const startDate = validDate(input.startDate, "startDate");
  const endDate = validDate(input.endDate, "endDate");
  const reason = requiredString(
    input.reason,
    "INVALID_REASON",
    "reason is required.",
  );

  let isHalfDay = false;
  if (input.isHalfDay !== undefined) {
    if (typeof input.isHalfDay !== "boolean") {
      throw new AppError(
        400,
        "INVALID_IS_HALF_DAY",
        "isHalfDay must be a boolean.",
      );
    }
    isHalfDay = input.isHalfDay;
  }

  let halfDayPeriod: HalfDayPeriod | undefined;
  if (isHalfDay) {
    if (
      typeof input.halfDayPeriod !== "string" ||
      !HALF_DAY_PERIODS.includes(input.halfDayPeriod as HalfDayPeriod)
    ) {
      throw new AppError(
        400,
        "INVALID_HALF_DAY_PERIOD",
        "halfDayPeriod must be 'morning' or 'afternoon'.",
      );
    }
    halfDayPeriod = input.halfDayPeriod as HalfDayPeriod;
    if (startDate !== endDate) {
      throw new AppError(
        400,
        "HALF_DAY_DATE_MISMATCH",
        "Half-day leave requires startDate to equal endDate.",
      );
    }
  } else if (startDate > endDate) {
    throw new AppError(
      400,
      "INVALID_DATE_RANGE",
      "startDate must be on or before endDate.",
    );
  }

  return { leaveTypeId, startDate, endDate, reason, isHalfDay, halfDayPeriod };
}

/**
 * Validates an HR Admin override on a leave request (LEAVE-15).
 *
 * Accepts a partial body with only the allowed update fields.  System/
 * attribution fields (submittedAt, manager*, reviewed*) are excluded so the
 * audit trail stays coherent.
 *
 * Per-field validation only; cross-field consistency is not enforced — the
 * caller may re-validate the merged record if needed.
 */
export function validateLeaveRequestUpdate(
  body: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};

  if (body.employeeId !== undefined) {
    patch.employeeId = requiredString(
      body.employeeId,
      "INVALID_EMPLOYEE_ID",
      "employeeId must be a non-empty string.",
    );
  }
  if (body.leaveTypeId !== undefined) {
    patch.leaveTypeId = requiredString(
      body.leaveTypeId,
      "INVALID_LEAVE_TYPE_ID",
      "leaveTypeId must be a non-empty string.",
    );
  }
  if (body.startDate !== undefined) {
    patch.startDate = validDate(body.startDate, "startDate");
  }
  if (body.endDate !== undefined) {
    patch.endDate = validDate(body.endDate, "endDate");
  }
  if (body.isHalfDay !== undefined) {
    if (typeof body.isHalfDay !== "boolean") {
      throw new AppError(
        400,
        "INVALID_IS_HALF_DAY",
        "isHalfDay must be a boolean.",
      );
    }
    patch.isHalfDay = body.isHalfDay;
  }
  if (body.halfDayPeriod !== undefined) {
    if (
      typeof body.halfDayPeriod !== "string" ||
      !HALF_DAY_PERIODS.includes(body.halfDayPeriod as HalfDayPeriod)
    ) {
      throw new AppError(
        400,
        "INVALID_HALF_DAY_PERIOD",
        "halfDayPeriod must be 'morning' or 'afternoon'.",
      );
    }
    patch.halfDayPeriod = body.halfDayPeriod;
  }
  if (body.numberOfDays !== undefined) {
    if (
      typeof body.numberOfDays !== "number" ||
      !Number.isFinite(body.numberOfDays) ||
      body.numberOfDays < 0
    ) {
      throw new AppError(
        400,
        "INVALID_NUMBER_OF_DAYS",
        "numberOfDays must be a non-negative number.",
      );
    }
    patch.numberOfDays = body.numberOfDays;
  }
  if (body.reason !== undefined) {
    patch.reason = requiredString(
      body.reason,
      "INVALID_REASON",
      "reason must be a non-empty string.",
    );
  }
  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !isLeaveRequestStatus(body.status)) {
      throw new AppError(
        400,
        "INVALID_STATUS",
        "status must be a valid leave request status.",
      );
    }
    patch.status = body.status;
  }

  return patch;
}
