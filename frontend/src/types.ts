export type InputType = "work_done" | "problem_found" | "need_item";
export type SyncStatus =
  | "pending"
  | "synced"
  | "failed"
  | "reviewed"
  | "local_only";

export interface FieldLog {
  id: string;
  created_at: string;
  updated_at: string;
  worker_name: string;
  site_location: string;
  input_type: InputType;
  summary: string;
  details: string;
  safety_related: boolean;
  follow_up_needed: boolean;
  urgency: "low" | "normal" | "high" | null;
  photo_path: string | null;
  sync_status: SyncStatus;
  clickup_task_id: string | null;
  clickup_task_url: string | null;
  sync_error: string | null;
  raw_payload_json: string;
}

export interface AppConfig {
  workers: string[];
  sites: string[];
  actions: Record<string, string>;
}

export interface CreateLogPayload {
  worker_name: string;
  site_location: string;
  input_type: InputType;
  summary: string;
  details?: string;
  safety_related?: boolean;
  follow_up_needed?: boolean;
  urgency?: "low" | "normal" | "high" | null;
  photo_path?: string | null;
}
