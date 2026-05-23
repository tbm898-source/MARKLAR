import { Router } from "express";
import { listLogs, isClickUpConfigured } from "../db.js";
import { isEmailConfigured, sendReportEmail } from "../services/email.js";
import type { InputType, SyncStatus } from "../types.js";

export const reportsRouter = Router();

reportsRouter.get("/status", (_req, res) => {
  res.json({
    emailConfigured: isEmailConfigured(),
    clickupConfigured: isClickUpConfigured(),
  });
});

reportsRouter.post("/email", async (req, res) => {
  if (!isEmailConfigured()) {
    res.status(400).json({
      error:
        "Email not configured. Set SMTP_HOST and REPORT_EMAIL_TO in .env — see README.",
    });
    return;
  }

  const status = req.body?.status as SyncStatus | undefined;
  const input_type = req.body?.input_type as InputType | undefined;
  const limit =
    typeof req.body?.limit === "number" ? req.body.limit : 50;

  const logs = listLogs({ status, input_type, limit });

  try {
    await sendReportEmail(logs);
    res.json({ ok: true, sent: logs.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: message });
  }
});
