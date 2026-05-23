import { Router } from "express";
import {
  getCanonicalStatus,
  getOperatorHealth,
  getSentinelStatus,
} from "../services/systemStatus.js";

export const systemRouter = Router();

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown system route error";
}

systemRouter.get("/sentinel", (_req, res) => {
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

systemRouter.get("/operator-health", (_req, res) => {
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

systemRouter.get("/canonical-status", (_req, res) => {
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
