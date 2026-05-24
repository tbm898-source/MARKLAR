import { Router } from "express";
import { getConfig } from "../config.js";
import {
  buildAdminSessionCookie,
  buildClearAdminSessionCookie,
  createAdminSession,
  destroyAdminSession,
  getAdminSessionCookie,
  isAdminAuthenticated,
  verifyAdminToken,
} from "../middleware/adminAuth.js";

export const adminRouter = Router();

adminRouter.post("/login", (req, res) => {
  const config = getConfig();
  const token = typeof req.body?.token === "string" ? req.body.token : "";

  if (!config.admin.token) {
    if (config.isProduction) {
      res.status(401).json({ error: "Admin authentication is not configured" });
      return;
    }

    res.status(204).end();
    return;
  }

  if (!verifyAdminToken(token)) {
    res.status(401).json({ error: "Invalid admin token" });
    return;
  }

  const sessionId = createAdminSession();
  res.setHeader("Set-Cookie", buildAdminSessionCookie(sessionId));
  res.status(204).end();
});

adminRouter.post("/logout", (req, res) => {
  destroyAdminSession(getAdminSessionCookie(req));
  res.setHeader("Set-Cookie", buildClearAdminSessionCookie());
  res.status(204).end();
});

adminRouter.get("/me", (req, res) => {
  res.json({ authenticated: isAdminAuthenticated(req) });
});
