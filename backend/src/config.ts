/**
 * Backend configuration loader (Phase 2 / PR 2a).
 *
 * Purpose
 *   - Centralize all backend boot-time configuration in one typed module.
 *   - Validate the *risky* values (PORT, NODE_ENV, CORS_ALLOWED_ORIGINS)
 *     up front, so misconfiguration fails fast with a clear message
 *     instead of producing a half-started server.
 *   - Provide a single, non-secret summary string for the startup log.
 *
 * Scope (intentional)
 *   - This module reads env vars and resolves filesystem paths only.
 *   - It does NOT open the database, send mail, or talk to ClickUp.
 *   - It does NOT add new runtime dependencies; only Node built-ins and
 *     the already-installed `dotenv` package are used.
 *
 * What is preserved
 *   - The existing production behavior where NODE_ENV=production and an
 *     empty CORS_ALLOWED_ORIGINS triggers a loud warning and falls
 *     closed for cross-origin browser requests (same-origin still works).
 *   - `FIELD_PULSE_ENV_PATH`, `FRONTEND_DIST_DIR`, and `UPLOADS_DIR` keep
 *     their existing override semantics for the Electron desktop wrapper.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

export type NodeEnv = "development" | "test" | "production";

export interface Config {
  /** Normalized NODE_ENV. */
  nodeEnv: NodeEnv;
  /** Convenience flag — true iff nodeEnv === "production". */
  isProduction: boolean;
  /** Validated HTTP port (1..65535). */
  port: number;
  /** Absolute filesystem path to the built frontend served by Express. */
  frontendDistDir: string;
  /** Absolute filesystem path to the photo uploads directory. */
  uploadsDir: string;
  /** Absolute filesystem path to the .env file that was loaded (or attempted). */
  envFilePath: string;
  /** Parsed, validated CORS allow-list (may be empty). */
  corsAllowedOrigins: readonly string[];
  /**
   * True iff NODE_ENV=production AND no CORS_ALLOWED_ORIGINS were
   * provided. Triggers the loud startup warning preserved from Phase 1.
   */
  corsProductionEmptyWarning: boolean;
  /**
   * Raw `DATABASE_URL` env value (or `undefined` if not set). PR 2b
   * preserves db.ts's existing path-resolution logic; only the input
   * source changes from `process.env.DATABASE_URL` to `config.databaseUrl`.
   */
  databaseUrl: string | undefined;
  /**
   * Raw `FIELD_PULSE_DATA_DIR` env value (or `undefined`). Used by db.ts
   * exactly as before; PR 2b does not normalize or resolve it here.
   */
  fieldPulseDataDir: string | undefined;
  /**
   * ClickUp credentials and base URL. PR 2b indirection only — no
   * validation. Missing values keep the existing "not configured"
   * behavior in `isClickUpConfigured()` and `createClickUpTask()`.
   */
  clickup: {
    apiToken: string | undefined;
    listId: string | undefined;
    /** Default `https://api.clickup.com/api/v2`. Never empty. */
    baseUrl: string;
  };
  /**
   * Email/SMTP settings. PR 2b indirection only — no validation. The
   * sample-value rejection and "not configured" fallback in email.ts
   * are preserved verbatim.
   */
  email: {
    host: string | undefined;
    /** Default 587 (matches previous parseInt fallback). */
    port: number;
    secure: boolean;
    user: string | undefined;
    pass: string | undefined;
    from: string | undefined;
    /** Raw, untrimmed REPORT_EMAIL_TO. email.ts splits/trims at use site. */
    reportTo: string | undefined;
  };
}

/**
 * Thrown when a required env var is malformed. We throw a plain Error
 * with a `[FieldPulse config]` prefix instead of subclassing so callers
 * can fail fast with a clear, greppable boot-time message and no new
 * runtime dependency.
 */
function configError(field: string, reason: string): Error {
  return new Error(`[FieldPulse config] ${field}: ${reason}`);
}

const VALID_NODE_ENVS: readonly NodeEnv[] = ["development", "test", "production"];

function parseNodeEnv(raw: string | undefined): NodeEnv {
  const value = (raw ?? "").trim().toLowerCase();
  if (value === "") return "development";
  if ((VALID_NODE_ENVS as readonly string[]).includes(value)) {
    return value as NodeEnv;
  }
  throw configError(
    "NODE_ENV",
    `expected one of ${VALID_NODE_ENVS.join(", ")} (got "${raw}")`,
  );
}

function parsePort(raw: string | undefined): number {
  const trimmed = (raw ?? "").trim();
  const value = trimmed === "" ? 3001 : Number(trimmed);
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    throw configError(
      "PORT",
      `expected an integer in 1..65535 (got "${raw}")`,
    );
  }
  return value;
}

/**
 * A valid origin is `scheme://host[:port]` with no path/query/fragment
 * and an http(s) scheme. We validate by re-serializing through the
 * WHATWG URL parser and requiring round-trip equality with `.origin`.
 */
function isValidOrigin(candidate: string): boolean {
  try {
    const url = new URL(candidate);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    if (url.username !== "" || url.password !== "") return false;
    if (url.pathname !== "/" && url.pathname !== "") return false;
    if (url.search !== "" || url.hash !== "") return false;
    return url.origin === candidate;
  } catch {
    return false;
  }
}

function parseCorsAllowedOrigins(
  raw: string | undefined,
  isProduction: boolean,
): string[] {
  const trimmed = (raw ?? "").trim();
  if (trimmed === "") return [];

  const entries = trimmed
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const accepted: string[] = [];
  for (const entry of entries) {
    if (entry === "*") {
      if (isProduction) {
        throw configError(
          "CORS_ALLOWED_ORIGINS",
          'wildcard "*" is not accepted in production. Provide an explicit, ' +
            "comma-separated list of allowed origins (scheme://host[:port]).",
        );
      }
      // Non-production: wildcard is honored as a no-op (the runtime matcher
      // uses exact string compare and would never match a real origin).
      // We exclude it from the effective list and warn so behavior is
      // predictable.
      console.warn(
        '[FieldPulse config] CORS_ALLOWED_ORIGINS: wildcard "*" is ignored ' +
          "(exact-origin allow-list only). Remove it to silence this warning.",
      );
      continue;
    }
    if (!isValidOrigin(entry)) {
      throw configError(
        "CORS_ALLOWED_ORIGINS",
        `"${entry}" is not a valid origin. Expected scheme://host[:port] ` +
          'with an http(s) scheme and no path/query/fragment (e.g. "https://app.example.com").',
      );
    }
    accepted.push(entry);
  }
  return accepted;
}

/**
 * Load + validate the backend configuration.
 *
 * This must be called from the process entry point exactly once, before
 * any module that depends on env vars (db, services, routers) is wired
 * into the Express app. It applies `dotenv.config` honoring
 * `FIELD_PULSE_ENV_PATH`.
 *
 * Throws a clear, prefixed Error on any validation failure.
 */
export function loadConfig(): Config {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(__dirname, "../..");

  const envFilePath = process.env.FIELD_PULSE_ENV_PATH
    ? path.resolve(process.env.FIELD_PULSE_ENV_PATH)
    : path.resolve(repoRoot, ".env");
  dotenv.config({ path: envFilePath });

  const nodeEnv = parseNodeEnv(process.env.NODE_ENV);
  const isProduction = nodeEnv === "production";
  const port = parsePort(process.env.PORT);

  const frontendDistDir = process.env.FRONTEND_DIST_DIR
    ? path.resolve(process.env.FRONTEND_DIST_DIR)
    : path.resolve(repoRoot, "frontend/dist");
  const uploadsDir = process.env.UPLOADS_DIR
    ? path.resolve(process.env.UPLOADS_DIR)
    : path.resolve(__dirname, "../uploads");

  const corsAllowedOrigins = parseCorsAllowedOrigins(
    process.env.CORS_ALLOWED_ORIGINS,
    isProduction,
  );
  const corsProductionEmptyWarning =
    isProduction && corsAllowedOrigins.length === 0;

  // --- PR 2b: indirection-only env passthrough (no validation here) ---
  //
  // These values are read out of process.env exactly as the call sites
  // did before, so we preserve behavior. The only change is that the
  // env is now read once at boot, and consumers go through `getConfig()`
  // instead of `process.env`.
  const databaseUrl = process.env.DATABASE_URL || undefined;
  const fieldPulseDataDir = process.env.FIELD_PULSE_DATA_DIR || undefined;

  const clickup = {
    apiToken: process.env.CLICKUP_API_TOKEN?.trim() || undefined,
    listId: process.env.CLICKUP_LIST_ID?.trim() || undefined,
    baseUrl:
      process.env.CLICKUP_BASE_URL?.trim() || "https://api.clickup.com/api/v2",
  };

  // SMTP_PORT preserves the previous `parseInt(.. ?? "587", 10)` fallback.
  // We do NOT add validation here — out of scope for PR 2b — so a
  // malformed value still flows through as NaN exactly like before.
  const smtpPortRaw = process.env.SMTP_PORT;
  const email = {
    host: process.env.SMTP_HOST?.trim() || undefined,
    port: smtpPortRaw === undefined ? 587 : parseInt(smtpPortRaw, 10),
    secure: process.env.SMTP_SECURE === "true",
    user: process.env.SMTP_USER?.trim() || undefined,
    pass: process.env.SMTP_PASS?.trim() || undefined,
    from: process.env.SMTP_FROM?.trim() || undefined,
    reportTo: process.env.REPORT_EMAIL_TO?.trim() || undefined,
  };

  const loaded: Config = {
    nodeEnv,
    isProduction,
    port,
    frontendDistDir,
    uploadsDir,
    envFilePath,
    corsAllowedOrigins,
    corsProductionEmptyWarning,
    databaseUrl,
    fieldPulseDataDir,
    clickup,
    email,
  };
  cachedConfig = loaded;
  return loaded;
}

/**
 * Module-level singleton storage for the loaded config (PR 2b).
 *
 * `loadConfig()` populates this once at boot from `index.ts`. Backend
 * modules (`db.ts`, `email.ts`, `clickup.ts`, `upload.ts`) read it
 * lazily via `getConfig()` — never at module top level — so the
 * import-order constraint is satisfied even though the modules are
 * imported by `index.ts` before `loadConfig()` runs.
 */
let cachedConfig: Config | null = null;

/**
 * Return the config loaded by a prior `loadConfig()` call.
 *
 * Throws a clear, prefixed Error if called before `loadConfig()`. This
 * guard makes the import-order rule self-enforcing: any future code
 * that accidentally reads config at module top level fails fast at
 * boot with an obvious message instead of silently picking up empty
 * env values.
 */
export function getConfig(): Config {
  if (!cachedConfig) {
    throw new Error(
      "[FieldPulse config] getConfig() called before loadConfig(). " +
        "Ensure loadConfig() runs at the top of the process entry point " +
        "before any router, db, or service function is invoked.",
    );
  }
  return cachedConfig;
}

/**
 * One-line, secret-free startup summary for the boot log. Intentionally
 * compact and stable so it can be grep'd by operators and CI.
 *
 * Format:
 *   [FieldPulse] config: mode=<nodeEnv> port=<port> frontend-dist=<path>
 *   uploads=<path> cors-allowlist=<count>
 *
 * The number of CORS entries is logged, never the entries themselves —
 * those origins are not secrets but the count is sufficient for sanity
 * checking and avoids accidental log diffing.
 */
export function summarizeConfig(config: Config): string {
  return (
    `[FieldPulse] config: mode=${config.nodeEnv} port=${config.port} ` +
    `frontend-dist=${config.frontendDistDir} uploads=${config.uploadsDir} ` +
    `cors-allowlist=${config.corsAllowedOrigins.length}`
  );
}
