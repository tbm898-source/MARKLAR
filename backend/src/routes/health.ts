import { Router } from "express";
import { isClickUpConfigured } from "../db.js";
import { isEmailConfigured } from "../services/email.js";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  res.json({
    ok: true,
    emailConfigured: isEmailConfigured(),
    clickupConfigured: isClickUpConfigured(),
  });
});
