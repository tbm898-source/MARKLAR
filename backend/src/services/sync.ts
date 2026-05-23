import { getLogById, updateSyncResult, isClickUpConfigured } from "../db.js";
import { createClickUpTask } from "./clickup.js";
import type { FieldLog } from "../types.js";

export async function syncLogToClickUp(id: string): Promise<FieldLog | null> {
  const log = getLogById(id);
  if (!log) return null;

  if (!isClickUpConfigured()) {
    return updateSyncResult(id, {
      sync_status: "local_only",
      sync_error: null,
    });
  }

  try {
    const { taskId, taskUrl } = await createClickUpTask(log);
    return updateSyncResult(id, {
      sync_status: "synced",
      clickup_task_id: taskId,
      clickup_task_url: taskUrl,
      sync_error: null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return updateSyncResult(id, {
      sync_status: "failed",
      sync_error: message,
    });
  }
}
