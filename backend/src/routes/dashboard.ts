import { Router } from "express";
import type { RequestHandler } from "express";
import { requireAuth } from "../middleware/auth";
import { getDashboard } from "../services/dashboard";

const getDashboardHandler: RequestHandler = async (req, res, next) => {
  try {
    const actor = req.auth;
    if (!actor) {
      res.status(401).json({
        error: {
          code: "UNAUTHENTICATED",
          message: "Authentication required.",
        },
      });
      return;
    }

    const dashboard = await getDashboard(actor);
    res.json({ dashboard });
  } catch (err) {
    next(err);
  }
};

export const dashboardRouter = Router();

dashboardRouter.get("/", requireAuth, getDashboardHandler);
