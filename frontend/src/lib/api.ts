import type { AppConfig, CreateLogPayload, FieldLog } from "../types.js";

/**
 * Resolve the API base URL.
 *
 * Default (empty / undefined VITE_API_BASE_URL): same-origin `/api`.
 *   - Used by local dev (via Vite proxy), desktop (Electron), and the
 *     single-server production mode where the backend serves the built
 *     frontend on the same origin.
 *
 * When VITE_API_BASE_URL is set (e.g. https://api.example.com): the client
 * talks to that absolute origin instead. Trailing slashes are stripped.
 * This is the hosted-API deployment mode (frontend and backend on
 * different origins, backend CORS must allow the frontend origin).
 */
function resolveApiBase(): string {
  const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  if (!raw) return "/api";
  const noTrailingSlash = raw.replace(/\/+$/, "");
  return `${noTrailingSlash}/api`;
}

export const API_BASE_URL = resolveApiBase();
const API = API_BASE_URL;
const CONFIG_CACHE_KEY = "fieldpulse_config_v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function isUnauthorizedError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

async function readErrorMessage(res: Response, fallback: string): Promise<string> {
  const err = (await res.json().catch(() => ({}))) as { error?: string; message?: string };
  return err.error ?? err.message ?? fallback;
}

async function throwApiError(res: Response, fallback: string): Promise<never> {
  throw new ApiError(await readErrorMessage(res, fallback), res.status);
}

const DEFAULT_CONFIG: AppConfig = {
  workers: ["Tim", "Andrew Peck", "Andrew Herman", "Other"],
  sites: [
    "Main Site",
    "Old Charleston School",
    "Baloni Ranch",
    "SE Site",
    "Work Truck",
    "Other",
  ],
  actions: {
    work_done: "I Did Something",
    problem_found: "I Found a Problem",
    need_item: "I Need Something",
  },
};

function readCachedConfig(): AppConfig | null {
  try {
    const cached = localStorage.getItem(CONFIG_CACHE_KEY);
    return cached ? (JSON.parse(cached) as AppConfig) : null;
  } catch {
    return null;
  }
}

export async function fetchConfig(): Promise<AppConfig> {
  try {
    const res = await fetch(`${API}/config`);
    if (!res.ok) throw new Error("Failed to load config");
    const config = (await res.json()) as AppConfig;
    localStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify(config));
    return config;
  } catch (err) {
    const cached = readCachedConfig();
    if (cached) return cached;
    if (!navigator.onLine) return DEFAULT_CONFIG;
    throw err;
  }
}

export async function createLog(payload: CreateLogPayload): Promise<FieldLog> {
  const res = await fetch(`${API}/logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: string }).error ?? `Submit failed (${res.status})`
    );
  }
  return res.json() as Promise<FieldLog>;
}

export async function fetchLogs(params?: {
  status?: string;
  input_type?: string;
}): Promise<FieldLog[]> {
  const q = new URLSearchParams();
  if (params?.status) q.set("status", params.status);
  if (params?.input_type) q.set("input_type", params.input_type);
  const qs = q.toString();
  const res = await fetch(`${API}/logs${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  if (!res.ok) await throwApiError(res, "Failed to load logs");
  return res.json() as Promise<FieldLog[]>;
}

export async function retrySync(id: string): Promise<FieldLog> {
  const res = await fetch(`${API}/logs/${id}/retry-sync`, {
    credentials: "include",
    method: "POST",
  });
  if (!res.ok) await throwApiError(res, "Retry failed");
  return res.json() as Promise<FieldLog>;
}

export async function fetchIntegrationStatus(): Promise<{
  emailConfigured: boolean;
  clickupConfigured: boolean;
}> {
  const res = await fetch(`${API}/reports/status`, {
    credentials: "include",
  });
  if (!res.ok) await throwApiError(res, "Failed to load status");
  return res.json() as Promise<{
    emailConfigured: boolean;
    clickupConfigured: boolean;
  }>;
}

export async function sendEmailReport(filters?: {
  status?: string;
  input_type?: string;
}): Promise<{ ok: boolean; sent: number }> {
  const res = await fetch(`${API}/reports/email`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...filters, limit: 50 }),
  });
  if (!res.ok) {
    await throwApiError(res, "Failed to send email report");
  }
  return res.json() as Promise<{ ok: boolean; sent: number }>;
}

export async function markReviewed(id: string): Promise<FieldLog> {
  const res = await fetch(`${API}/logs/${id}/mark-reviewed`, {
    credentials: "include",
    method: "POST",
  });
  if (!res.ok) await throwApiError(res, "Mark reviewed failed");
  return res.json() as Promise<FieldLog>;
}

export async function fetchAdminAuthStatus(): Promise<{ authenticated: boolean }> {
  const res = await fetch(`${API}/admin/me`, {
    credentials: "include",
  });
  if (!res.ok) await throwApiError(res, "Failed to check admin session");
  return res.json() as Promise<{ authenticated: boolean }>;
}

export async function loginAdmin(token: string): Promise<void> {
  const res = await fetch(`${API}/admin/login`, {
    credentials: "include",
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) await throwApiError(res, "Admin login failed");
}

export async function logoutAdmin(): Promise<void> {
  const res = await fetch(`${API}/admin/logout`, {
    credentials: "include",
    method: "POST",
  });
  if (!res.ok) await throwApiError(res, "Admin logout failed");
}

export async function uploadPhoto(file: File): Promise<string> {
  const form = new FormData();
  form.append("photo", file);
  const res = await fetch(`${API}/upload-photo`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Photo upload failed");
  const data = (await res.json()) as { path: string };
  return data.path;
}

export async function submitLog(
  payload: CreateLogPayload
): Promise<{ ok: true; queued: boolean }> {
  try {
    await createLog(payload);
    return { ok: true, queued: false };
  } catch (err) {
    const isNetwork =
      err instanceof TypeError ||
      (err instanceof Error && err.message.includes("Failed to fetch"));
    if (isNetwork || !navigator.onLine) {
      const { enqueueLog } = await import("./offlineQueue.js");
      await enqueueLog(payload);
      return { ok: true, queued: true };
    }
    throw err;
  }
}

export type SystemStatusLevel =
  | "ok"
  | "warning"
  | "error"
  | "missing"
  | "not_configured";

export type SentinelStatusResponse = {
  ok: boolean;
  status: SystemStatusLevel;
  configured: boolean;
  exists: boolean;
  lastModified: string | null;
  isStale: boolean;
  staleThresholdHours: number;
  content: string | null;
  message?: string;
};

export type CanonicalStatusItem = {
  key: string;
  label: string;
  relativePath: string;
  exists: boolean;
  lastModified: string | null;
  isStale: boolean;
  status: "ok" | "warning" | "missing";
  isDirectory?: boolean;
  preview?: string | null;
  itemCount?: number;
  message?: string;
};

export type CanonicalStatusResponse = {
  ok: boolean;
  status: SystemStatusLevel;
  configured: boolean;
  rootSource?: "env" | "dropbox" | "none";
  items: CanonicalStatusItem[];
  message?: string;
};

export type OperatorHealthResponse = {
  ok: boolean;
  status: SystemStatusLevel;
  configured: boolean;
  exists: boolean;
  source: "cached_file" | "not_available";
  lastSnapshotTime: string | null;
  isStale: boolean;
  uptime?: string | null;
  networkAdapters?: Array<{
    name: string;
    status?: string;
    linkSpeed?: string | null;
  }>;
  tailscaleStatus?: {
    present: boolean;
    connected?: boolean | null;
    message?: string;
  };
  warnings?: string[];
  rawSummary?: string | null;
  message?: string;
};

async function fetchSystemStatusJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
  });
  const text = await response.text();

  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }
    throw new Error("Backend returned a non-JSON response.");
  }

  if (!response.ok) {
    throw new ApiError(
      payload?.message || payload?.error || `Request failed: ${response.status}`,
      response.status,
    );
  }

  return payload as T;
}

export async function fetchSystemSentinel(): Promise<SentinelStatusResponse> {
  return fetchSystemStatusJson<SentinelStatusResponse>(`${API}/system/sentinel`);
}

export async function fetchOperatorHealth(): Promise<OperatorHealthResponse> {
  return fetchSystemStatusJson<OperatorHealthResponse>(`${API}/system/operator-health`);
}

export async function fetchCanonicalStatus(): Promise<CanonicalStatusResponse> {
  return fetchSystemStatusJson<CanonicalStatusResponse>(`${API}/system/canonical-status`);
}
