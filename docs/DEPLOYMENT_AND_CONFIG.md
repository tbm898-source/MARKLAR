# Deployment Modes and Configuration

Phase 1 readiness notes for FieldPulse Lite. This document describes the
three supported deployment modes, the environment variables that control
them, and a plain-markdown smoke-test checklist for each mode.

Phase 1 does **not** introduce auth, mobile/native installers, Capacitor,
new Electron features, or schema changes. Worker, admin, and Goliath V1
read-only boundaries are preserved as-is.

## Deployment modes

| Mode | Frontend origin | Backend origin | `VITE_API_BASE_URL` | `CORS_ALLOWED_ORIGINS` |
|------|-----------------|----------------|---------------------|------------------------|
| Local dev | `http://localhost:5173` | `http://localhost:3001` (via Vite proxy) | empty | empty (dev defaults applied) |
| Production single-server | same as backend | `http://HOST:3001` | empty | empty |
| Desktop (Electron) | same as backend | `http://localhost:3001` | empty | empty |
| Hosted API (future) | `https://app.example.com` | `https://api.example.com` | `https://api.example.com` | `https://app.example.com` |

In every mode the frontend client appends `/api` to the resolved base URL.
When `VITE_API_BASE_URL` is empty the client uses same-origin `/api`.

## Environment variables (Phase 1)

| Variable | Where | Effect |
|----------|-------|--------|
| `VITE_API_BASE_URL` | frontend build | Absolute origin (no `/api` suffix) the frontend should call. Empty = same-origin `/api`. |
| `CORS_ALLOWED_ORIGINS` | backend | Comma-separated list of origins permitted to call the API from a browser. Required in production for cross-origin clients. |
| `NODE_ENV` | backend | When set to `production`, the backend enters strict CORS mode (no dev localhost defaults, fail-closed if `CORS_ALLOWED_ORIGINS` is empty). |
| `PORT` | backend | Backend HTTP port. Default `3001`. |
| `DATABASE_URL` | backend | SQLite database path. Default `file:./data/fieldpulse.sqlite`. |
| `FRONTEND_DIST_DIR` | backend | Optional override for the built frontend directory served by Express. |
| `UPLOADS_DIR` | backend | Optional override for the photo upload directory. |
| `FIELD_PULSE_ENV_PATH` | backend | Optional override for the `.env` file location (used by the desktop app). |

### CORS policy summary

- Same-origin and non-browser requests (no `Origin` header) are always
  allowed.
- Local/dev (`NODE_ENV != "production"`): the dev defaults
  `http://localhost:5173`, `http://127.0.0.1:5173`,
  `http://localhost:3001`, `http://127.0.0.1:3001` are allowed plus any
  origins listed in `CORS_ALLOWED_ORIGINS`.
- Production (`NODE_ENV=production`): only origins listed in
  `CORS_ALLOWED_ORIGINS` are allowed. Empty list fails closed with a loud
  warning at startup.
- Wildcard `*` is intentionally **not** supported in production.

## Smoke-test checklist

Use this checklist after a configuration change or build. The commands are
documentation only — Phase 1 deliberately does not add bash or PowerShell
smoke-test scripts.

### A. Local dev (two processes, Vite proxy)

```bash
npm run install:all
npm run db:init
npm run dev
```

- [ ] Backend boots and prints `FieldPulse Lite is running`.
- [ ] `http://localhost:5173/worker` loads the worker home (`WorkerHome`).
- [ ] `http://localhost:5173/admin` loads the admin dashboard.
- [ ] `curl http://localhost:3001/api/health` returns `{"ok":true,...}`.
- [ ] `curl http://localhost:3001/api/system/sentinel` returns JSON with a
      `status` field.
- [ ] `curl http://localhost:3001/api/system/canonical-status` returns
      JSON with an `items` array.
- [ ] `curl http://localhost:3001/api/system/operator-health` returns JSON
      with a `source` field of `cached_file` or `not_available`.
- [ ] Worker form submits and the success screen renders.
- [ ] Browser devtools network tab shows requests going to `/api/...`
      (proxied to `http://localhost:3001` by Vite).

### B. Production single-server (backend serves built frontend)

```bash
npm run build --prefix frontend
npm run build --prefix backend
npm run start
```

- [ ] Frontend `dist/` and backend `dist/` both exist.
- [ ] `http://localhost:3001/worker` loads from the backend-served bundle.
- [ ] `http://localhost:3001/admin` loads.
- [ ] `curl http://localhost:3001/api/health` returns `{"ok":true,...}`.
- [ ] All three `/api/system/*` endpoints return JSON.
- [ ] No cross-origin requests appear in the browser network tab — all
      API calls are same-origin on port 3001.
- [ ] SQLite file at `backend/data/fieldpulse.sqlite` is created/used and
      is **not** committed to Git.
- [ ] `frontend/dist`, `backend/dist`, `node_modules/`, `*.exe`, and
      `*.sqlite*` are all absent from `git status`.

### C. Future hosted-API mode (frontend and backend on different origins)

Build the frontend with the hosted backend origin baked in, then deploy
the backend with the frontend origin permitted.

```bash
# Build frontend pointing at the hosted backend
VITE_API_BASE_URL=https://api.example.com \
  npm run build --prefix frontend

# Run backend with explicit allowed origin(s)
NODE_ENV=production \
  CORS_ALLOWED_ORIGINS=https://app.example.com \
  npm run start --prefix backend
```

- [ ] Frontend bundle contains the hosted backend origin (grep
      `dist/assets/*.js` for `api.example.com`).
- [ ] Backend startup log shows no CORS warning.
- [ ] Browser at `https://app.example.com/worker` shows API requests to
      `https://api.example.com/api/...` with `200` responses.
- [ ] An untrusted origin (e.g. `https://evil.example.com`) is rejected
      by CORS — the browser logs a CORS error and the request never
      reaches a route handler.
- [ ] With `CORS_ALLOWED_ORIGINS` unset in production, the backend logs
      the loud warning on boot and cross-origin requests are rejected
      while same-origin still works.

## What Phase 1 does NOT change

- `/worker` and `/admin` route handlers and behavior.
- Goliath V1 read-only endpoints (`/api/system/sentinel`,
  `/api/system/operator-health`, `/api/system/canonical-status`) remain
  read-only and file/cache-based. No PowerShell, no child process
  spawning, no frontend-triggered execution, no user-supplied paths.
- SQLite schema and the local-first worker submission flow.
- Electron desktop bootstrap; no Capacitor work yet.
- Authentication; none added.
- `.gitignore` posture: `node_modules/`, `dist/`, `build/`, `release/`,
  `*.exe`, `*.sqlite*`, and `backend/uploads/*` remain ignored.
