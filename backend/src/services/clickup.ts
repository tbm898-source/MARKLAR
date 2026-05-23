import type { FieldLog } from "../types.js";

function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

export function buildTaskName(log: FieldLog): string {
  const date = formatDate(log.created_at);
  switch (log.input_type) {
    case "work_done":
      return `Work Done - ${log.worker_name} - ${date}`;
    case "problem_found":
      return `Problem Found - ${log.site_location} - ${date}`;
    case "need_item":
      return `Need Item - ${log.summary} - ${date}`;
    default:
      return `Field Entry - ${date}`;
  }
}

function formatInputType(type: string): string {
  switch (type) {
    case "work_done":
      return "Work Done";
    case "problem_found":
      return "Problem Found";
    case "need_item":
      return "Need Item";
    default:
      return type;
  }
}

function formatUrgency(urgency: FieldLog["urgency"]): string {
  if (!urgency) return "None";
  return urgency.charAt(0).toUpperCase() + urgency.slice(1);
}

export function buildTaskDescription(log: FieldLog): string {
  return `# FieldPulse Lite Entry

## Type
${formatInputType(log.input_type)}

## Worker
${log.worker_name}

## Site / Location
${log.site_location}

## Summary
${log.summary}

## Details
${log.details || "(none)"}

## Safety Related
${log.safety_related ? "Yes" : "No"}

## Follow-Up Needed
${log.follow_up_needed ? "Yes" : "No"}

## Urgency
${formatUrgency(log.urgency)}

## Submitted At
${log.created_at}

## Local Record ID
${log.id}
`;
}

export function resolvePriority(log: FieldLog): number | undefined {
  if (log.safety_related) return 1;
  if (log.urgency === "high") return 2;
  if (log.urgency === "normal") return 3;
  if (log.urgency === "low") return 4;
  return undefined;
}

export interface ClickUpTaskResult {
  taskId: string;
  taskUrl: string;
}

export async function createClickUpTask(
  log: FieldLog
): Promise<ClickUpTaskResult> {
  const token = process.env.CLICKUP_API_TOKEN?.trim();
  const listId = process.env.CLICKUP_LIST_ID?.trim();
  const baseUrl =
    process.env.CLICKUP_BASE_URL?.trim() ||
    "https://api.clickup.com/api/v2";

  if (!token || !listId) {
    throw new Error("ClickUp is not configured (missing token or list ID)");
  }

  const body: Record<string, unknown> = {
    name: buildTaskName(log),
    description: buildTaskDescription(log),
    markdown_description: buildTaskDescription(log),
  };

  const priority = resolvePriority(log);
  if (priority !== undefined) {
    body.priority = priority;
  }

  const res = await fetch(`${baseUrl}/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: token,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });

  const text = await res.text();
  let data: { id?: string; err?: string; ECODE?: string };
  try {
    data = JSON.parse(text) as typeof data;
  } catch {
    throw new Error(`ClickUp API error (${res.status}): ${text.slice(0, 500)}`);
  }

  if (!res.ok) {
    const msg =
      data.err || data.ECODE || text.slice(0, 500) || `HTTP ${res.status}`;
    throw new Error(`ClickUp API error: ${msg}`);
  }

  const taskId = data.id;
  if (!taskId) {
    throw new Error("ClickUp API returned no task id");
  }

  return {
    taskId,
    taskUrl: `https://app.clickup.com/t/${taskId}`,
  };
}
