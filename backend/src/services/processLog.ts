import { getLogById, updateSyncResult, isClickUpConfigured } from "../db.js";
import { syncLogToClickUp } from "./sync.js";
import { sendLogEmail } from "./email.js";
import type { FieldLog } from "../types.js";

export async function processAfterSave(id: string): Promise<FieldLog | null> {
  let log = getLogById(id);
  if (!log) return null;

  if (isClickUpConfigured()) {
    log = (await syncLogToClickUp(id)) ?? log;
  } else {
    log =
      updateSyncResult(id, {
        sync_status: "local_only",
        sync_error: null,
      }) ?? log;
  }

  try {
    await sendLogEmail(log);
  } catch (err) {
    console.error("[FieldPulse] Email failed:", err);
  }

  return getLogById(id);
}
