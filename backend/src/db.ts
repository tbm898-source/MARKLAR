import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getConfig } from "./config.js";
import type { CreateLogBody, FieldLog, InputType, SyncStatus } from "./types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, "..");

let db: Database.Database | null = null;

function getDataDir(): string {
  // PR 2b: read FIELD_PULSE_DATA_DIR via getConfig() instead of
  // process.env. Resolution logic preserved byte-for-byte.
  const fieldPulseDataDir = getConfig().fieldPulseDataDir;
  return fieldPulseDataDir
    ? path.resolve(fieldPulseDataDir)
    : path.resolve(backendRoot, "data");
}

export function getDbPath(): string {
  // PR 2b: read DATABASE_URL and FIELD_PULSE_DATA_DIR via getConfig().
  // The branching/resolution rules below are preserved byte-for-byte.
  const config = getConfig();
  const url = config.databaseUrl;
  if (!url) {
    return path.resolve(getDataDir(), "fieldpulse.sqlite");
  }

  const relative = url.replace(/^file:/, "");
  if (path.isAbsolute(relative)) return relative;

  if (
    config.fieldPulseDataDir &&
    (relative === "./data/fieldpulse.sqlite" ||
      relative === "data/fieldpulse.sqlite")
  ) {
    return path.resolve(getDataDir(), "fieldpulse.sqlite");
  }

  const baseDir = config.fieldPulseDataDir ? getDataDir() : backendRoot;
  return path.resolve(baseDir, relative);
}

export function getDb(): Database.Database {
  if (!db) {
    const dbPath = getDbPath();
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma("journal_mode = WAL");
    initSchema();
  }
  return db;
}

export function initSchema(): void {
  const database = db ?? new Database(getDbPath());
  database.exec(`
    CREATE TABLE IF NOT EXISTS field_logs (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      site_location TEXT NOT NULL,
      input_type TEXT NOT NULL CHECK (input_type IN ('work_done','problem_found','need_item')),
      summary TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      safety_related INTEGER NOT NULL DEFAULT 0,
      follow_up_needed INTEGER NOT NULL DEFAULT 0,
      urgency TEXT CHECK (urgency IN ('low','normal','high') OR urgency IS NULL),
      photo_path TEXT,
      sync_status TEXT NOT NULL CHECK (sync_status IN ('pending','synced','failed','reviewed','local_only')),
      clickup_task_id TEXT,
      clickup_task_url TEXT,
      sync_error TEXT,
      raw_payload_json TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_field_logs_sync_status ON field_logs(sync_status);
    CREATE INDEX IF NOT EXISTS idx_field_logs_input_type ON field_logs(input_type);
    CREATE INDEX IF NOT EXISTS idx_field_logs_created_at ON field_logs(created_at DESC);
  `);
  migrateLocalOnlyStatus(database);
  if (!db) {
    database.close();
  }
}

function migrateLocalOnlyStatus(database: Database.Database): void {
  const row = database
    .prepare(
      "SELECT sql FROM sqlite_master WHERE type='table' AND name='field_logs'"
    )
    .get() as { sql?: string } | undefined;
  if (!row?.sql || row.sql.includes("local_only")) return;

  database.exec(`
    CREATE TABLE field_logs_new (
      id TEXT PRIMARY KEY,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      worker_name TEXT NOT NULL,
      site_location TEXT NOT NULL,
      input_type TEXT NOT NULL CHECK (input_type IN ('work_done','problem_found','need_item')),
      summary TEXT NOT NULL,
      details TEXT NOT NULL DEFAULT '',
      safety_related INTEGER NOT NULL DEFAULT 0,
      follow_up_needed INTEGER NOT NULL DEFAULT 0,
      urgency TEXT CHECK (urgency IN ('low','normal','high') OR urgency IS NULL),
      photo_path TEXT,
      sync_status TEXT NOT NULL CHECK (sync_status IN ('pending','synced','failed','reviewed','local_only')),
      clickup_task_id TEXT,
      clickup_task_url TEXT,
      sync_error TEXT,
      raw_payload_json TEXT NOT NULL
    );
    INSERT INTO field_logs_new SELECT * FROM field_logs;
    DROP TABLE field_logs;
    ALTER TABLE field_logs_new RENAME TO field_logs;
    CREATE INDEX IF NOT EXISTS idx_field_logs_sync_status ON field_logs(sync_status);
    CREATE INDEX IF NOT EXISTS idx_field_logs_input_type ON field_logs(input_type);
    CREATE INDEX IF NOT EXISTS idx_field_logs_created_at ON field_logs(created_at DESC);
  `);
}

function rowToLog(row: Record<string, unknown>): FieldLog {
  return {
    id: row.id as string,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    worker_name: row.worker_name as string,
    site_location: row.site_location as string,
    input_type: row.input_type as InputType,
    summary: row.summary as string,
    details: row.details as string,
    safety_related: Boolean(row.safety_related),
    follow_up_needed: Boolean(row.follow_up_needed),
    urgency: (row.urgency as FieldLog["urgency"]) ?? null,
    photo_path: (row.photo_path as string | null) ?? null,
    sync_status: row.sync_status as SyncStatus,
    clickup_task_id: (row.clickup_task_id as string | null) ?? null,
    clickup_task_url: (row.clickup_task_url as string | null) ?? null,
    sync_error: (row.sync_error as string | null) ?? null,
    raw_payload_json: row.raw_payload_json as string,
  };
}

export function insertLog(
  id: string,
  body: CreateLogBody,
  rawPayload: string
): FieldLog {
  const now = new Date().toISOString();
  const database = getDb();
  database
    .prepare(
      `INSERT INTO field_logs (
        id, created_at, updated_at, worker_name, site_location, input_type,
        summary, details, safety_related, follow_up_needed, urgency, photo_path,
        sync_status, clickup_task_id, clickup_task_url, sync_error, raw_payload_json
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        'pending', NULL, NULL, NULL, ?
      )`
    )
    .run(
      id,
      now,
      now,
      body.worker_name,
      body.site_location,
      body.input_type,
      body.summary,
      body.details ?? "",
      body.safety_related ? 1 : 0,
      body.follow_up_needed ? 1 : 0,
      body.urgency ?? null,
      body.photo_path ?? null,
      rawPayload
    );
  return getLogById(id)!;
}

export function getLogById(id: string): FieldLog | null {
  const row = getDb().prepare("SELECT * FROM field_logs WHERE id = ?").get(id);
  return row ? rowToLog(row as Record<string, unknown>) : null;
}

export function listLogs(filters: {
  status?: SyncStatus;
  input_type?: InputType;
  limit?: number;
  offset?: number;
}): FieldLog[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push("sync_status = ?");
    params.push(filters.status);
  }
  if (filters.input_type) {
    conditions.push("input_type = ?");
    params.push(filters.input_type);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filters.limit ?? 200;
  const offset = filters.offset ?? 0;

  const rows = getDb()
    .prepare(
      `SELECT * FROM field_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return rows.map((r) => rowToLog(r as Record<string, unknown>));
}

export function updateSyncResult(
  id: string,
  result: {
    sync_status: SyncStatus;
    clickup_task_id?: string | null;
    clickup_task_url?: string | null;
    sync_error?: string | null;
  }
): FieldLog | null {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE field_logs SET
        updated_at = ?,
        sync_status = ?,
        clickup_task_id = ?,
        clickup_task_url = ?,
        sync_error = ?
      WHERE id = ?`
    )
    .run(
      now,
      result.sync_status,
      result.clickup_task_id ?? null,
      result.clickup_task_url ?? null,
      result.sync_error ?? null,
      id
    );
  return getLogById(id);
}

export function markReviewed(id: string): FieldLog | null {
  const now = new Date().toISOString();
  getDb()
    .prepare(
      `UPDATE field_logs SET updated_at = ?, sync_status = 'reviewed' WHERE id = ?`
    )
    .run(now, id);
  return getLogById(id);
}

export function isClickUpConfigured(): boolean {
  // PR 2b: read ClickUp credentials via getConfig() instead of process.env.
  // Sample-placeholder rejection preserved verbatim.
  const { apiToken, listId } = getConfig().clickup;
  return Boolean(
    apiToken &&
      apiToken !== "pk_your_token_here" &&
      listId &&
      listId !== "your_clickup_list_id_here"
  );
}
