import { Router } from "express";
import { getLanIp } from "../util/network.js";
import { isEmailConfigured } from "../services/email.js";
import { isClickUpConfigured } from "../db.js";

export const setupRouter = Router();

setupRouter.get("/", (req, res) => {
  const port = parseInt(process.env.PORT ?? "3001", 10);
  const host = req.get("host")?.split(":")[0];
  const lanIp = getLanIp();
  const baseLan = `http://${lanIp}:${port}`;
  const baseLocal = `http://localhost:${port}`;

  res.json({
    port,
    lanIp,
    hostHeader: host,
    workerUrl: `${baseLan}/worker`,
    adminUrl: `${baseLan}/admin`,
    setupUrl: `${baseLan}/setup`,
    localWorkerUrl: `${baseLocal}/worker`,
    emailConfigured: isEmailConfigured(),
    clickupConfigured: isClickUpConfigured(),
    phoneInstructions: [
      "Connect phone to the same Wi-Fi as this computer.",
      "Open the worker URL below in Safari (iPhone) or Chrome (Android).",
      "Add to Home Screen for a full-screen app icon (optional).",
    ],
  });
});
