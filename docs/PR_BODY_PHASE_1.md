# Phase 1: platform readiness (VITE_API_BASE_URL + configurable CORS + deployment docs)

Phase 1 of the full-stack readiness work. No rewrites, no Capacitor, no
Electron overhaul, no schema or worker-flow changes. Goliath V1
read-only boundaries are preserved.

## What this PR does

1. Adds `VITE_API_BASE_URL` support to the frontend API client. Empty /
   unset keeps the existing same-origin `/api` behavior (local dev,
   Electron desktop, production single-server). Setting it to an
   absolute origin (no `/api` suffix) enables the hosted-API mode.
2. Makes the backend CORS posture configurable via
   `CORS_ALLOWED_ORIGINS` (comma-separated). Local/dev keeps the usual
   localhost dev origins. Production with an empty list is fail-closed
   and logs a loud warning. Wildcard `*` is intentionally not supported
   in production.
3. Documents the three deployment modes (local dev, production
   single-server, future hosted API) and adds a plain-markdown
   smoke-test checklist for each (`docs/DEPLOYMENT_AND_CONFIG.md`).
4. Updates `.env.example` with the new variables and inline guidance.

## Changed files

- `.env.example`
- `backend/src/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/SetupPage.tsx`
- `frontend/src/vite-env.d.ts`
- `docs/DEPLOYMENT_AND_CONFIG.md` (new)

## Validation

- `npm run build --prefix backend` ✅
- `npm run build --prefix frontend` ✅
- `VITE_API_BASE_URL=https://api.example.com npm run build --prefix frontend`
  ✅ — confirmed the hosted-API origin is baked into the dist bundle.
- `npm run dev` ✅ — backend + Vite both up.
- `/worker` 200 (via Vite 5173 and via backend 3001)
- `/admin` 200 (via Vite 5173 and via backend 3001)
- `/api/health` returns `{"ok":true, ...}`
- `/api/system/sentinel`, `/api/system/canonical-status`,
  `/api/system/operator-health` all return valid JSON with the
  documented schema. (Status is `not_configured` in CI/dev environments
  without `CANONICAL_ROOT` — graceful V1 fallback works as designed.)
- CORS matrix verified:
  - dev + allowed origin → header echoed
  - dev + disallowed origin → header omitted (browser blocks); no 500
  - prod + empty `CORS_ALLOWED_ORIGINS` → loud warning + cross-origin
    rejected; same-origin still works
  - prod + listed origin → header echoed; other origins blocked

## Risks

1. Disallowed-origin requests in production return `200 OK` with the
   `Access-Control-Allow-Origin` header omitted (browser-side block).
   Chosen for clean logs. Documented in
   `docs/DEPLOYMENT_AND_CONFIG.md`.
2. `credentials: true` is set on CORS — fine if future hosted
   deployments need cookies; can be tightened later.
3. When `VITE_API_BASE_URL` is set during `npm run dev`, the Vite proxy
   is bypassed (requests go to the absolute URL). Expected behavior.

## V1 constraints — not violated

- `/worker`, `/admin`, and Goliath V1 `/api/system/*` handlers unchanged.
- No live PowerShell, no backend child-process spawning, no
  frontend-triggered execution, no user-supplied paths.
- SQLite schema unchanged; local-first flow preserved.
- `.gitignore` posture intact — no dist, node_modules, sqlite, or
  installer artifacts staged.
- No auth, no Capacitor, no Electron overhaul, no mobile/native
  installer work.

## Out of scope (deferred)

- `/api/version` endpoint (backlog idea only).
- Capacitor wrapper track.
- Electron packaging refresh.
- `/admin` authentication.
- Mobile/native installer work.
- Phase 2 planning — blocked until the `codex/next-work` branch
  (`docs/FULL_STACK_APP_ROADMAP.md`, `docs/CROSS_PLATFORM_AUDIT.md`)
  is merged or otherwise available.

## Do not deploy from this PR.
