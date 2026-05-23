import { Router } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  insertLog,
  getLogById,
  listLogs,
  markReviewed,
  isClickUpConfigured,
} from "../db.js";
import { processAfterSave } from "../services/processLog.js";
import { syncLogToClickUp } from "../services/sync.js";
import type { CreateLogBody, InputType, SyncStatus } from "../types.js";

export const logsRouter = Router();

const INPUT_TYPES: InputType[] = ["work_done", "problem_found", "need_item"];

function validateBody(body: unknown): CreateLogBody | string {
  if (!body || typeof body !== "object") return "Invalid body";
  const b = body as Record<string, unknown>;

  if (!b.worker_name || typeof b.worker_name !== "string") {
    return "worker_name is required";
  }
  if (!b.site_location || typeof b.site_location !== "string") {
    return "site_location is required";
  }
  if (!b.input_type || !INPUT_TYPES.includes(b.input_type as InputType)) {
    return "input_type must be work_done, problem_found, or need_item";
  }
  if (!b.summary || typeof b.summary !== "string") {
    return "summary is required";
  }

  return {
    worker_name: b.worker_name.trim(),
    site_location: b.site_location.trim(),
    input_type: b.input_type as InputType,
    summary: b.summary.trim(),
    details: typeof b.details === "string" ? b.details.trim() : "",
    safety_related: Boolean(b.safety_related),
    follow_up_needed: Boolean(b.follow_up_needed),
    urgency:
      b.urgency === "low" || b.urgency === "normal" || b.urgency === "high"
        ? b.urgency
        : null,
    photo_path:
      typeof b.photo_path === "string" ? b.photo_path : null,
  };
}

logsRouter.post("/", async (req, res) => {
  const validated = validateBody(req.body);
  if (typeof validated === "string") {
    res.status(400).json({ error: validated });
    return;
  }

  const id = uuidv4();
  const rawPayload = JSON.stringify(req.body);
  const log = insertLog(id, validated, rawPayload);

  const result = await processAfterSave(id);
  res.status(201).json(result ?? log);
});

logsRouter.get("/", (req, res) => {
  const status = req.query.status as SyncStatus | undefined;
  const input_type = req.query.input_type as InputType | undefined;
  const limit = req.query.limit
    ? parseInt(String(req.query.limit), 10)
    : undefined;
  const offset = req.query.offset
    ? parseInt(String(req.query.offset), 10)
    : undefined;

  const logs = listLogs({ status, input_type, limit, offset });
  res.json(logs);
});

logsRouter.get("/:id", (req, res) => {
  const log = getLogById(req.params.id);
  if (!log) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(log);
});

logsRouter.post("/:id/retry-sync", async (req, res) => {
  const log = getLogById(req.params.id);
  if (!log) {
    res.status(404).json({ error: "Not found" });
    return;
  }

  if (!isClickUpConfigured()) {
    res.status(400).json({
      error: "ClickUp is not configured. Add CLICKUP_API_TOKEN and CLICKUP_LIST_ID to .env",
    });
    return;
  }

  if (
    log.sync_status !== "failed" &&
    log.sync_status !== "pending" &&
    log.sync_status !== "local_only"
  ) {
    res.status(400).json({
      error: "Can only retry sync for pending, failed, or local-only records",
    });
    return;
  }

  const synced = await syncLogToClickUp(req.params.id);
  res.json(synced);
});

logsRouter.post("/:id/mark-reviewed", (req, res) => {
  const log = markReviewed(req.params.id);
  if (!log) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json(log);
});
