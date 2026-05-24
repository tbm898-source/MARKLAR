import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import express from "express";
import cors, { type CorsOptions } from "cors";
import { getDb } from "./db.js";
import { healthRouter } from "./routes/health.js";
import { configRouter } from "./routes/config.js";
import { logsRouter } from "./routes/logs.js";
import { uploadRouter } from "./routes/upload.js";
import { reportsRouter } from "./routes/reports.js";
import { setupRouter } from "./routes/setup.js";
import { systemRouter } from "./routes/system.js";
import { getLanIp } from "./util/network.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../..");

dotenv.config({
  path: process.env.FIELD_PULSE_ENV_PATH ?? path.resolve(repoRoot, ".env"),
});

const frontendDist = process.env.FRONTEND_DIST_DIR
  ? path.resolve(process.env.FRONTEND_DIST_DIR)
  : path.resolve(repoRoot, "frontend/dist");
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.resolve(__dirname, "../uploads");

getDb();

const app = express();
const port = parseInt(process.env.PORT ?? "3001", 10);

/**
 * CORS configuration.
 *
 * The default deployment mode is single-origin: backend serves the built
 * frontend, so no cross-origin requests happen and CORS is effectively a
 * no-op. The hosted-API mode (frontend and backend on different origins)
 * requires `CORS_ALLOWED_ORIGINS` to be set explicitly to a comma-separated
 * list of allowed origins.
 *
 * Rules:
 *   - Local/dev (NODE_ENV !== "production"): allow common localhost dev
 *     origins by default, plus anything listed in CORS_ALLOWED_ORIGINS.
 *   - Production (NODE_ENV === "production"):
 *       * If CORS_ALLOWED_ORIGINS is set: only those origins are allowed.
 *       * If CORS_ALLOWED_ORIGINS is empty: fail closed — no cross-origin
 *         requests are accepted (same-origin still works because those
 *         requests do not carry an Origin header that CORS rejects). A
 *         loud warning is logged so operators notice the misconfiguration.
 *   - Wildcard `*` is never used in production.
 */
const isProduction = (process.env.NODE_ENV ?? "").toLowerCase() === "production";
const corsEnv = (process.env.CORS_ALLOWED_ORIGINS ?? "").trim();
const configuredOrigins = corsEnv
  ? corsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

const devDefaultOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:3001",
  "http://127.0.0.1:3001",
];

const allowedOrigins = isProduction
  ? configuredOrigins
  : Array.from(new Set([...devDefaultOrigins, ...configuredOrigins]));

if (isProduction && configuredOrigins.length === 0) {
  console.warn(
    "[FieldPulse] WARNING: NODE_ENV=production but CORS_ALLOWED_ORIGINS is empty. " +
      "All cross-origin requests will be rejected. Set CORS_ALLOWED_ORIGINS to a " +
      "comma-separated list of allowed frontend origins, or use single-server mode.",
  );
}

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

app.use("/uploads", express.static(uploadsDir));

app.use("/api/health", healthRouter);
app.use("/api/config", configRouter);
app.use("/api/logs", logsRouter);
app.use("/api/upload-photo", uploadRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/setup", setupRouter);
app.use("/api/system", systemRouter);

if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/uploads")) {
      next();
      return;
    }
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

app.listen(port, "0.0.0.0", () => {
  const lan = getLanIp();
  console.log("");
  console.log("  FieldPulse Lite is running");
  console.log("  -------------------------");
  console.log(`  On this PC:     http://localhost:${port}/setup`);
  console.log(`  On phones:      http://${lan}:${port}/worker`);
  console.log(`  Admin:          http://localhost:${port}/admin`);
  console.log("");
  if (fs.existsSync(frontendDist)) {
    console.log(`  Serving app from ${frontendDist}`);
  } else {
    console.log("  (Run npm run build for production / phone testing)");
  }
  console.log("");
});
