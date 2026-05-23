import fs from "node:fs";
import path from "node:path";

export type SystemStatusLevel =
  | "ok"
  | "warning"
  | "error"
  | "missing"
  | "not_configured";

type RootResolution =
  | {
      configured: true;
      root: string;
      source: "env" | "dropbox";
      message?: string;
    }
  | {
      configured: false;
      root: null;
      source: "none";
      message: string;
    };

type CanonicalTrackedItem = {
  key: string;
  label: string;
  relativePath: string;
  staleThresholdHours?: number;
  isDirectory?: boolean;
  preview?: boolean;
};

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

const SENTINEL_RELATIVE_PATH = path.join(
  "01_OPS",
  "REMINDERS",
  "SENTINEL_LAST.md",
);

const TRACKED_ITEMS: CanonicalTrackedItem[] = [
  {
    key: "lastDailyRun",
    label: "Last Daily Run",
    relativePath: path.join("01_OPS", "REMINDERS", "LAST_DAILY_RUN.md"),
    staleThresholdHours: 36,
    preview: true,
  },
  {
    key: "nudgeGlance",
    label: "Nudge Glance",
    relativePath: path.join("01_OPS", "REMINDERS", "NUDGE_GLANCE.md"),
    staleThresholdHours: 24,
    preview: true,
  },
  {
    key: "sentinelLast",
    label: "Sentinel Snapshot",
    relativePath: SENTINEL_RELATIVE_PATH,
    staleThresholdHours: 24,
    preview: true,
  },
  {
    key: "opsLogs",
    label: "Ops Logs",
    relativePath: path.join("01_OPS", "LOGS"),
    isDirectory: true,
  },
];

const OPERATOR_SEARCH_DIRECTORIES = [
  path.join("01_OPS", "LOGS"),
  path.join("01_OPS"),
];

const OPERATOR_SNAPSHOT_FILE_PATTERNS = [
  /operator.*snapshot/i,
  /operator_host/i,
  /host.*snapshot/i,
  /host.*health/i,
];

function toIso(value: Date | string | number | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function formatDurationFromSeconds(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) {
    return "Unknown";
  }

  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (days > 0 || hours > 0) parts.push(`${hours}h`);
  parts.push(`${minutes}m`);
  return parts.join(" ");
}

function hoursSince(iso: string | null): number | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return (Date.now() - date.getTime()) / (1000 * 60 * 60);
}

function isStale(lastModifiedIso: string | null, thresholdHours?: number): boolean {
  if (!lastModifiedIso || !thresholdHours) return false;
  const ageHours = hoursSince(lastModifiedIso);
  return ageHours !== null && ageHours > thresholdHours;
}

function previewText(content: string | null, maxLength = 600): string | null {
  if (!content) return null;
  return content.length <= maxLength
    ? content
    : `${content.slice(0, maxLength).trimEnd()}…`;
}

function safeRelativePath(relativePath: string): string {
  return relativePath.replace(/\\/g, "/");
}

function safeResolveUnderRoot(root: string, relativePath: string): string {
  const resolvedRoot = path.resolve(root);
  const resolvedPath = path.resolve(resolvedRoot, relativePath);

  if (
    resolvedPath !== resolvedRoot &&
    !resolvedPath.startsWith(`${resolvedRoot}${path.sep}`)
  ) {
    throw new Error(`Resolved path escaped CANONICAL root: ${relativePath}`);
  }

  return resolvedPath;
}

function resolveCanonicalRoot(): RootResolution {
  const envRoot = process.env.CANONICAL_ROOT?.trim();
  if (envRoot) {
    const resolved = path.resolve(envRoot);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
      return { configured: true, root: resolved, source: "env" };
    }
  }

  const userProfile = process.env.USERPROFILE?.trim();
  if (userProfile) {
    const dropboxRoot = path.resolve(userProfile, "Dropbox", "CANONICAL");
    if (fs.existsSync(dropboxRoot) && fs.statSync(dropboxRoot).isDirectory()) {
      return { configured: true, root: dropboxRoot, source: "dropbox" };
    }
  }

  return {
    configured: false,
    root: null,
    source: "none",
    message:
      "CANONICAL_ROOT not configured and Dropbox fallback not found.",
  };
}

function readTextFile(absPath: string): string | null {
  try {
    return fs.readFileSync(absPath, "utf8");
  } catch {
    return null;
  }
}

function getLatestModifiedInDirectory(
  directoryPath: string,
  maxDepth = 2,
): { lastModified: string | null; itemCount: number } {
  let newestTime = 0;
  let itemCount = 0;

  function walk(currentPath: string, depth: number): void {
    if (depth > maxDepth) return;

    let entries: fs.Dirent[] = [];
    try {
      entries = fs.readdirSync(currentPath, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const childPath = path.join(currentPath, entry.name);
      itemCount += 1;

      try {
        const stat = fs.statSync(childPath);
        if (stat.mtimeMs > newestTime) {
          newestTime = stat.mtimeMs;
        }
      } catch {
        // ignore unreadable child
      }

      if (entry.isDirectory()) {
        walk(childPath, depth + 1);
      }
    }
  }

  walk(directoryPath, 0);

  return {
    lastModified: newestTime ? new Date(newestTime).toISOString() : null,
    itemCount,
  };
}

function statusFromExistsAndStale(
  exists: boolean,
  stale: boolean,
): "ok" | "warning" | "missing" {
  if (!exists) return "missing";
  if (stale) return "warning";
  return "ok";
}

function buildTrackedItem(root: string, item: CanonicalTrackedItem): CanonicalStatusItem {
  const absPath = safeResolveUnderRoot(root, item.relativePath);

  if (!fs.existsSync(absPath)) {
    return {
      key: item.key,
      label: item.label,
      relativePath: safeRelativePath(item.relativePath),
      exists: false,
      lastModified: null,
      isStale: false,
      status: "missing",
      isDirectory: item.isDirectory,
      preview: null,
      message: "Missing",
    };
  }

  const stat = fs.statSync(absPath);

  if (item.isDirectory) {
    const { lastModified, itemCount } = getLatestModifiedInDirectory(absPath);
    return {
      key: item.key,
      label: item.label,
      relativePath: safeRelativePath(item.relativePath),
      exists: true,
      lastModified,
      isStale: false,
      status: "ok",
      isDirectory: true,
      itemCount,
    };
  }

  const lastModified = toIso(stat.mtime);
  const stale = isStale(lastModified, item.staleThresholdHours);
  const content = item.preview ? readTextFile(absPath) : null;

  return {
    key: item.key,
    label: item.label,
    relativePath: safeRelativePath(item.relativePath),
    exists: true,
    lastModified,
    isStale: stale,
    status: statusFromExistsAndStale(true, stale),
    preview: item.preview ? previewText(content) : null,
  };
}

function overallCanonicalStatus(items: CanonicalStatusItem[]): SystemStatusLevel {
  if (items.some((item) => item.status === "missing")) return "warning";
  if (items.some((item) => item.status === "warning")) return "warning";
  return "ok";
}

function collectFilesRecursive(
  startPath: string,
  maxDepth = 3,
  results: string[] = [],
): string[] {
  if (!fs.existsSync(startPath)) return results;
  if (maxDepth < 0) return results;

  let entries: fs.Dirent[] = [];
  try {
    entries = fs.readdirSync(startPath, { withFileTypes: true });
  } catch {
    return results;
  }

  for (const entry of entries) {
    const fullPath = path.join(startPath, entry.name);
    if (entry.isDirectory()) {
      collectFilesRecursive(fullPath, maxDepth - 1, results);
      continue;
    }
    results.push(fullPath);
  }

  return results;
}

function findLatestOperatorSnapshot(root: string): { filePath: string; mtime: number } | null {
  const candidates: Array<{ filePath: string; mtime: number }> = [];

  for (const relativeDir of OPERATOR_SEARCH_DIRECTORIES) {
    const absDir = safeResolveUnderRoot(root, relativeDir);
    if (!fs.existsSync(absDir)) continue;

    const files = collectFilesRecursive(absDir, 3);
    for (const filePath of files) {
      const fileName = path.basename(filePath);
      const ext = path.extname(filePath).toLowerCase();

      if (![".json", ".log", ".txt", ".md"].includes(ext)) continue;
      if (!OPERATOR_SNAPSHOT_FILE_PATTERNS.some((pattern) => pattern.test(fileName))) {
        continue;
      }

      try {
        const stat = fs.statSync(filePath);
        candidates.push({ filePath, mtime: stat.mtimeMs });
      } catch {
        // ignore unreadable candidate
      }
    }
  }

  candidates.sort((a, b) => b.mtime - a.mtime);
  return candidates[0] ?? null;
}

function parseLooseJson(raw: string): unknown | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // continue to json-line fallback
    }
  }

  const lines = trimmed.split(/\r?\n/).reverse();
  for (const line of lines) {
    const candidate = line.trim();
    if (!candidate) continue;
    if (!candidate.startsWith("{") && !candidate.startsWith("[")) continue;
    try {
      return JSON.parse(candidate);
    } catch {
      // continue
    }
  }

  return null;
}

function getPathValue(input: unknown, expression: string): unknown {
  if (!input || typeof input !== "object") return undefined;

  const parts = expression.split(".");
  let current: unknown = input;

  for (const part of parts) {
    if (!current || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

function pickFirst(input: unknown, paths: string[]): unknown {
  for (const candidatePath of paths) {
    const value = getPathValue(input, candidatePath);
    if (value !== undefined && value !== null) {
      return value;
    }
  }
  return undefined;
}

function normalizeNetworkAdapters(
  input: unknown,
): Array<{ name: string; status?: string; linkSpeed?: string | null }> {
  if (!Array.isArray(input)) return [];

  return input
    .map((entry, index) => {
      if (typeof entry === "string") {
        return { name: entry };
      }

      if (!entry || typeof entry !== "object") {
        return { name: `adapter-${index + 1}` };
      }

      const source = entry as Record<string, unknown>;
      const name =
        String(
          source.name ??
            source.alias ??
            source.interfaceAlias ??
            source.description ??
            source.adapterName ??
            `adapter-${index + 1}`,
        ) || `adapter-${index + 1}`;

      const statusValue =
        source.status ?? source.operStatus ?? source.operationalStatus ?? source.state;
      const speedValue =
        source.linkSpeed ??
        source.linkSpeedMbps ??
        source.speed ??
        source.speedMbps ??
        null;

      return {
        name,
        status: statusValue ? String(statusValue) : undefined,
        linkSpeed: speedValue ? String(speedValue) : null,
      };
    })
    .filter((entry) => Boolean(entry.name));
}

function normalizeTailscaleStatus(input: unknown): {
  present: boolean;
  connected?: boolean | null;
  message?: string;
} {
  if (typeof input === "boolean") {
    return { present: input, connected: input };
  }

  if (typeof input === "string") {
    return { present: true, message: input };
  }

  if (!input || typeof input !== "object") {
    return { present: false, connected: null, message: "No Tailscale data found." };
  }

  const source = input as Record<string, unknown>;
  const present = Boolean(source.present ?? source.installed ?? true);
  const connectedValue =
    source.connected ?? source.up ?? source.online ?? source.running ?? null;

  const connected =
    typeof connectedValue === "boolean" ? connectedValue : connectedValue == null ? null : null;

  const message =
    typeof source.message === "string"
      ? source.message
      : typeof source.status === "string"
        ? source.status
        : undefined;

  return { present, connected, message };
}

function normalizeOperatorHealth(
  parsed: unknown,
  fallbackTime: string | null,
): Omit<OperatorHealthResponse, "configured" | "exists" | "source"> {
  const lastSnapshotTime =
    (pickFirst(parsed, [
      "generatedAtUtc",
      "generatedAt",
      "timestamp",
      "createdAt",
      "created_at",
      "snapshot.generatedAtUtc",
    ]) as string | undefined) ?? fallbackTime;

  const uptimeRaw = pickFirst(parsed, [
    "os.uptimeHuman",
    "uptimeHuman",
    "uptime",
    "host.uptime",
    "system.uptimeHuman",
  ]);

  const uptimeSecondsRaw = pickFirst(parsed, [
    "os.uptimeSeconds",
    "uptimeSeconds",
    "host.uptimeSeconds",
    "system.uptimeSeconds",
  ]);

  let uptime: string | null = null;
  if (typeof uptimeRaw === "string") {
    uptime = uptimeRaw;
  } else if (typeof uptimeSecondsRaw === "number") {
    uptime = formatDurationFromSeconds(uptimeSecondsRaw);
  }

  const adaptersRaw = pickFirst(parsed, [
    "network.activeAdapters",
    "network.adapters",
    "networkAdapters",
    "adapters",
    "interfaces",
    "network.interfaces",
  ]);

  const tailscaleRaw = pickFirst(parsed, ["tailscale", "network.tailscale"]);

  const networkAdapters = normalizeNetworkAdapters(adaptersRaw);
  const tailscaleStatus = normalizeTailscaleStatus(tailscaleRaw);
  const warnings: string[] = [];
  const stale = isStale(lastSnapshotTime ?? null, 24);

  if (stale) warnings.push("Operator snapshot is stale.");
  if (!tailscaleStatus.present) warnings.push("Tailscale not detected.");

  return {
    ok: true,
    status: stale || !tailscaleStatus.present ? "warning" : "ok",
    lastSnapshotTime: lastSnapshotTime ?? null,
    isStale: stale,
    uptime,
    networkAdapters,
    tailscaleStatus,
    warnings,
    rawSummary: null,
  };
}

export function getSentinelStatus(): SentinelStatusResponse {
  const canonical = resolveCanonicalRoot();
  if (!canonical.configured) {
    return {
      ok: false,
      status: "not_configured",
      configured: false,
      exists: false,
      lastModified: null,
      isStale: false,
      staleThresholdHours: 24,
      content: null,
      message: canonical.message,
    };
  }

  const absPath = safeResolveUnderRoot(canonical.root, SENTINEL_RELATIVE_PATH);
  if (!fs.existsSync(absPath)) {
    return {
      ok: false,
      status: "missing",
      configured: true,
      exists: false,
      lastModified: null,
      isStale: false,
      staleThresholdHours: 24,
      content: null,
      message: "Sentinel snapshot file not found.",
    };
  }

  const stat = fs.statSync(absPath);
  const lastModified = toIso(stat.mtime);
  const stale = isStale(lastModified, 24);

  return {
    ok: true,
    status: stale ? "warning" : "ok",
    configured: true,
    exists: true,
    lastModified,
    isStale: stale,
    staleThresholdHours: 24,
    content: readTextFile(absPath),
    message: stale ? "Sentinel snapshot is stale." : undefined,
  };
}

export function getCanonicalStatus(): CanonicalStatusResponse {
  const canonical = resolveCanonicalRoot();
  if (!canonical.configured) {
    return {
      ok: false,
      status: "not_configured",
      configured: false,
      rootSource: canonical.source,
      items: [],
      message: canonical.message,
    };
  }

  const items = TRACKED_ITEMS.map((item) => buildTrackedItem(canonical.root, item));

  return {
    ok: true,
    status: overallCanonicalStatus(items),
    configured: true,
    rootSource: canonical.source,
    items,
  };
}

export function getOperatorHealth(): OperatorHealthResponse {
  const canonical = resolveCanonicalRoot();
  if (!canonical.configured) {
    return {
      ok: false,
      status: "not_configured",
      configured: false,
      exists: false,
      source: "not_available",
      lastSnapshotTime: null,
      isStale: false,
      warnings: [],
      message: canonical.message,
    };
  }

  const latest = findLatestOperatorSnapshot(canonical.root);
  if (!latest) {
    return {
      ok: false,
      status: "warning",
      configured: true,
      exists: false,
      source: "not_available",
      lastSnapshotTime: null,
      isStale: false,
      warnings: ["No cached operator host snapshot was found."],
      message:
        "Operator health is not available because no approved cached snapshot/log file could be found. V1 does not execute PowerShell scripts live.",
    };
  }

  const raw = readTextFile(latest.filePath);
  const fallbackTime = toIso(new Date(latest.mtime));

  if (!raw) {
    return {
      ok: false,
      status: "warning",
      configured: true,
      exists: true,
      source: "cached_file",
      lastSnapshotTime: fallbackTime,
      isStale: isStale(fallbackTime, 24),
      warnings: ["Cached operator snapshot exists but could not be read."],
      rawSummary: null,
      message: "Cached operator snapshot exists but could not be read.",
    };
  }

  const parsed = parseLooseJson(raw);
  if (!parsed) {
    return {
      ok: false,
      status: "warning",
      configured: true,
      exists: true,
      source: "cached_file",
      lastSnapshotTime: fallbackTime,
      isStale: isStale(fallbackTime, 24),
      warnings: ["Cached operator snapshot could not be parsed as structured JSON."],
      rawSummary: previewText(raw, 500),
      message:
        "Cached operator snapshot was found, but it is not in a structured JSON format the dashboard can normalize.",
    };
  }

  return {
    configured: true,
    exists: true,
    source: "cached_file",
    ...normalizeOperatorHealth(parsed, fallbackTime),
  };
}
