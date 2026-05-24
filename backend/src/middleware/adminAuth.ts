import crypto from "node:crypto";
import type { Request, RequestHandler } from "express";
import { getConfig } from "../config.js";

const HOUR_MS = 60 * 60 * 1000;

const sessions = new Map<string, number>();

function unauthorized(message = "Admin authentication required") {
  return { error: message };
}

function getCookieValue(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    const rawValue = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }

  return undefined;
}

function getBearerToken(req: Request): string | undefined {
  const authorization = req.get("authorization");
  if (!authorization) return undefined;

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function verifyAdminToken(candidate: string): boolean {
  const expected = getConfig().admin.token;
  if (!expected) return false;

  const expectedBuffer = Buffer.from(expected);
  const candidateBuffer = Buffer.from(candidate);
  if (expectedBuffer.length !== candidateBuffer.length) return false;

  return crypto.timingSafeEqual(expectedBuffer, candidateBuffer);
}

function pruneExpiredSessions(now = Date.now()): void {
  for (const [sessionId, expiresAt] of sessions) {
    if (expiresAt <= now) {
      sessions.delete(sessionId);
    }
  }
}

export function createAdminSession(): string {
  const config = getConfig();
  pruneExpiredSessions();
  const sessionId = crypto.randomBytes(32).toString("base64url");
  sessions.set(sessionId, Date.now() + config.admin.sessionTtlHours * HOUR_MS);
  return sessionId;
}

export function destroyAdminSession(sessionId: string | undefined): void {
  if (sessionId) {
    sessions.delete(sessionId);
  }
}

export function isAdminSessionValid(sessionId: string | undefined): boolean {
  if (!sessionId) return false;

  const expiresAt = sessions.get(sessionId);
  if (!expiresAt) return false;

  if (expiresAt <= Date.now()) {
    sessions.delete(sessionId);
    return false;
  }

  return true;
}

export function getAdminSessionCookie(req: Request): string | undefined {
  return getCookieValue(req, getConfig().admin.cookieName);
}

function cookieSecurityAttributes(): string {
  return getConfig().isProduction ? "; Secure" : "";
}

export function buildAdminSessionCookie(sessionId: string): string {
  const config = getConfig();
  const maxAgeSeconds = config.admin.sessionTtlHours * 60 * 60;
  return (
    `${config.admin.cookieName}=${encodeURIComponent(sessionId)}` +
    `; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=Lax` +
    cookieSecurityAttributes()
  );
}

export function buildClearAdminSessionCookie(): string {
  const config = getConfig();
  return (
    `${config.admin.cookieName}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax` +
    cookieSecurityAttributes()
  );
}

export function isAdminAuthenticated(req: Request): boolean {
  const config = getConfig();

  if (!config.admin.token) {
    return !config.isProduction;
  }

  const bearerToken = getBearerToken(req);
  if (bearerToken && verifyAdminToken(bearerToken)) {
    return true;
  }

  return isAdminSessionValid(getAdminSessionCookie(req));
}

export const requireAdmin: RequestHandler = (req, res, next) => {
  const config = getConfig();

  if (!config.admin.token && !config.isProduction) {
    next();
    return;
  }

  if (isAdminAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).json(unauthorized());
};

export const requireAdminForUploadRead: RequestHandler = (req, res, next) => {
  const config = getConfig();

  if (!config.admin.token && !config.isProduction) {
    next();
    return;
  }

  if (isAdminAuthenticated(req)) {
    next();
    return;
  }

  res.status(401).send("Admin authentication required");
};
