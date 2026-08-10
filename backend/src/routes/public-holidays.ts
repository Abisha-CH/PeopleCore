import { Router } from "express";
import type { RequestHandler } from "express";
import { db } from "../config/firebase";
import { AppError } from "../errors";
import { validatePublicHolidayInput } from "../lib/validate-leave-config";
import { requireAuth, requireRole } from "../middleware/auth";
import { setAudit } from "../middleware/audit";
import { setResult } from "../middleware/respond";
import { writeRoute } from "./write";

// ---- helpers ----------------------------------------------------------------

function deriveYear(date: string): number {
  return Number(date.slice(0, 4));
}

function serialise(doc: {
  id: string;
  data(): Record<string, unknown> | undefined;
}) {
  const data = doc.data();
  return {
    publicHolidayId: doc.id,
    name: data?.name as string,
    date: data?.date as string,
    year: data?.year as number,
  };
}

async function findDuplicateDate(
  date: string,
  excludeId?: string,
): Promise<boolean> {
  const snap = await db.collection("publicHolidays").get();
  return snap.docs.some(
    (d) => d.id !== excludeId && d.data()?.date === date,
  );
}

// ---- handlers ---------------------------------------------------------------

const createHoliday: RequestHandler = async (req, res, next) => {
  try {
    const input = validatePublicHolidayInput(req.body ?? {});

    if (await findDuplicateDate(input.date)) {
      throw new AppError(
        409,
        "DUPLICATE_DATE",
        "A public holiday with this date already exists.",
      );
    }

    const ref = db.collection("publicHolidays").doc();
    const year = deriveYear(input.date);
    await ref.set({ name: input.name, date: input.date, year });

    const publicHoliday = {
      publicHolidayId: ref.id,
      name: input.name,
      date: input.date,
      year,
    };

    setAudit(res, {
      action: "public_holiday.create",
      targetType: "PublicHoliday",
      targetId: ref.id,
    });
    setResult(res, 201, { publicHoliday });
    next();
  } catch (err) {
    next(err);
  }
};

const listHolidays: RequestHandler = async (req, res) => {
  const { year: yearRaw } = req.query;
  let yearFilter: number | undefined;

  if (yearRaw !== undefined) {
    const parsed = typeof yearRaw === "string" ? Number(yearRaw) : NaN;
    if (!Number.isInteger(parsed) || parsed <= 0) {
      res.status(400).json({
        error: {
          code: "INVALID_YEAR",
          message: "Year must be a valid calendar year.",
        },
      });
      return;
    }
    yearFilter = parsed;
  }

  const snap = await db.collection("publicHolidays").get();
  let holidays = snap.docs
    .map((d) => serialise(d))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (yearFilter !== undefined) {
    holidays = holidays.filter((h) => h.year === yearFilter);
  }

  res.json({ publicHolidays: holidays, total: holidays.length });
};

const getHoliday: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db.collection("publicHolidays").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Public holiday not found.");
    }

    res.json({ publicHoliday: serialise(doc) });
  } catch (err) {
    next(err);
  }
};

const updateHoliday: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;
    const input = validatePublicHolidayInput(req.body ?? {});

    const existingDoc = await db.collection("publicHolidays").doc(id).get();
    if (!existingDoc.exists) {
      throw new AppError(404, "NOT_FOUND", "Public holiday not found.");
    }

    if (await findDuplicateDate(input.date, id)) {
      throw new AppError(
        409,
        "DUPLICATE_DATE",
        "A public holiday with this date already exists.",
      );
    }

    const before = existingDoc.data();
    const year = deriveYear(input.date);
    const nextRecord = { name: input.name, date: input.date, year };

    await db.collection("publicHolidays").doc(id).set(nextRecord);

    const diff: Record<string, { before: unknown; after: unknown }> = {};
    for (const key of ["name", "date", "year"] as const) {
      if (before?.[key] !== nextRecord[key]) {
        diff[key] = { before: before?.[key], after: nextRecord[key] };
      }
    }

    setAudit(res, {
      action: "public_holiday.update",
      targetType: "PublicHoliday",
      targetId: id,
      ...(Object.keys(diff).length > 0 ? { diff } : {}),
    });
    setResult(res, 200, {
      publicHoliday: { publicHolidayId: id, ...nextRecord },
    });
    next();
  } catch (err) {
    next(err);
  }
};

const deleteHoliday: RequestHandler = async (req, res, next) => {
  try {
    const raw = req.params.id;
    const id = Array.isArray(raw) ? raw[0] : raw;

    const doc = await db.collection("publicHolidays").doc(id).get();
    if (!doc.exists) {
      throw new AppError(404, "NOT_FOUND", "Public holiday not found.");
    }

    const data = doc.data();
    await db.collection("publicHolidays").doc(id).delete();

    setAudit(res, {
      action: "public_holiday.delete",
      targetType: "PublicHoliday",
      targetId: id,
    });
    setResult(res, 200, {
      publicHoliday: {
        publicHolidayId: id,
        name: data?.name as string,
        date: data?.date as string,
        year: data?.year as number,
      },
    });
    next();
  } catch (err) {
    next(err);
  }
};

// ---- router ----------------------------------------------------------------

export const publicHolidaysRouter = Router();

publicHolidaysRouter.post(
  "/",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(createHoliday),
);
publicHolidaysRouter.get(
  "/",
  requireAuth,
  requireRole("admin"),
  listHolidays,
);
publicHolidaysRouter.get(
  "/:id",
  requireAuth,
  requireRole("admin"),
  getHoliday,
);
publicHolidaysRouter.put(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(updateHoliday),
);
publicHolidaysRouter.delete(
  "/:id",
  requireAuth,
  requireRole("admin"),
  ...writeRoute(deleteHoliday),
);
