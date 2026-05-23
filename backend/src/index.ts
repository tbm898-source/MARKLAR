import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
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

app.use(cors());
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
