import { Router } from "express";
import {
  getCanonicalStatus,
  getOperatorHealth,
  getSentinelStatus,
} from "../services/systemStatus.js";
import { requireAdmin } from "../middleware/adminAuth.js";

export const systemRouter = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown system route error";
}

systemRouter.get("/sentinel", requireAdmin, (_req, res) => {
  try {
    res.json(getSentinelStatus());
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    });
  }
});

systemRouter.get("/operator-health", requireAdmin, (_req, res) => {
  try {
    res.json(getOperatorHealth());
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    });
  }
});

systemRouter.get("/canonical-status", requireAdmin, (_req, res) => {
  try {
    res.json(getCanonicalStatus());
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: "error",
      message: getErrorMessage(error),
    });
  }
});
