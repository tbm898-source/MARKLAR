import path from "node:path";
import fs from "node:fs";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { loadConfig, summarizeConfig } from "./config.js";
import { getDb } from "./db.js";
import { healthRouter } from "./routes/health.js";
import { adminRouter } from "./routes/admin.js";
import { configRouter } from "./routes/config.js";
import { logsRouter } from "./routes/logs.js";
import { uploadRouter } from "./routes/upload.js";
import { reportsRouter } from "./routes/reports.js";
import { setupRouter } from "./routes/setup.js";
import { systemRouter } from "./routes/system.js";
import { getLanIp } from "./util/network.js";

// Load and validate boot config first. Any malformed env var throws here
// with a clear `[FieldPulse config] ...` message; the process exits
// before any router is mounted or the DB is opened.
const config = loadConfig();

// One-line, secret-free startup summary. Logged before any other output.
console.log(summarizeConfig(config));

// Preserve the Phase 1 loud warning for production + empty CORS allow-list.
if (config.corsProductionEmptyWarning) {
  console.warn(
    "[FieldPulse] WARNING: NODE_ENV=production but CORS_ALLOWED_ORIGINS is empty. " +
      "All cross-origin requests will be rejected. Set CORS_ALLOWED_ORIGINS to a " +
      "comma-separated list of allowed frontend origins, or use single-server mode.",
  );
}

if (!config.admin.token) {
  if (config.isProduction) {
    console.warn(
      "[FieldPulse] WARNING: NODE_ENV=production but ADMIN_TOKEN is empty. " +
        "All admin routes will respond 401. Set ADMIN_TOKEN to enable the admin gate.",
    );
  } else {
    console.warn(
      "[FieldPulse] WARNING: ADMIN_TOKEN is empty — admin routes are OPEN. " +
        "Set ADMIN_TOKEN in .env to enable the admin gate.",
    );
  }
}

getDb();

const app = express();

/**
 * CORS configuration.
 *
 * The default deployment mode is single-origin: backend serves the built
 * frontend, so no cross-origin requests happen and CORS is effectively a
 * no-op. The hosted-API mode (frontend and backend on different origins)
 * requires `CORS_ALLOWED_ORIGINS` to be set explicitly to a comma-separated
 * list of allowed origins.
 *
 * Rules (validated by ./config.ts at boot):
 *   - Local/dev (NODE_ENV !== "production"): allow common localhost dev
 *     origins by default, plus anything listed in CORS_ALLOWED_ORIGINS.
 *   - Production (NODE_ENV === "production"):
 *       * If CORS_ALLOWED_ORIGINS is set: only those origins are allowed.
 *       * If CORS_ALLOWED_ORIGINS is empty: fail closed — no cross-origin
 *         requests are accepted (same-origin still works because those
 *         requests do not carry an Origin header that CORS rejects). A
 *         loud warning is logged so operators notice the misconfiguration.
 *   - Wildcard `*` is rejected at boot in production and ignored in dev.
 */
const devDefaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const allowedOrigins = config.isProduction
  ? config.corsAllowedOrigins
  : Array.from(new Set([...devDefaultOrigins, ...config.corsAllowedOrigins]));

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    // Same-origin / non-browser requests have no Origin header — always allow.
    if (!origin) {
      callback(null, true);
      return;
    }
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }
    // Disallowed origin: respond without CORS headers. The browser will
    // block the response. We deliberately do NOT throw so the request log
    // stays clean and the backend does not surface a 500.
    callback(null, false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "2mb" }));

app.use("/uploads", express.static(config.uploadsDir));

app.use("/api/health", healthRouter);
app.use("/api/admin", adminRouter);
app.use("/api/config", configRouter);
app.use("/api/logs", logsRouter);
app.use("/api/upload-photo", uploadRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/setup", setupRouter);
app.use("/api/system", systemRouter);

if (fs.existsSync(config.frontendDistDir)) {
  app.use(express.static(config.frontendDistDir));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(config.frontendDistDir, "index.html"));
  });
}

app.listen(config.port, "0.0.0.0", () => {
  const lan = getLanIp();
  console.log("");
  console.log("  FieldPulse Lite is running");
  console.log("  -------------------------");
  console.log(`  On this PC:     http://localhost:${config.port}/setup`);
  console.log(`  On phones:      http://${lan}:${config.port}/worker`);
  console.log(`  Admin:          http://localhost:${config.port}/admin`);
  console.log("");
  if (fs.existsSync(config.frontendDistDir)) {
    console.log(`  Serving app from ${config.frontendDistDir}`);
  } else {
    console.log("  (Run npm run build for production / phone testing)");
  }
  console.log("");
});
