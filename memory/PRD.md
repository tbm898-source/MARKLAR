# FieldPulse Lite — PRD (working memory)

## Original problem statement (verbatim, condensed)

Turn FieldPulse Lite into a full-stack app for web, Android, iPhone, Windows,
and Mac — but for now do **Phase 1 only**. Do not rewrite. Do not add
Capacitor. Do not overhaul Electron. Do not change worker flow.

Phase 1 deliverables:
1. Add `VITE_API_BASE_URL` support to the frontend API client.
2. Keep same-origin `/api` as the default.
3. Make backend CORS configurable for hosted mode.
4. Add clearer production/local config docs.
5. Add smoke-test instructions (local dev, production single-server, future
   hosted API).
6. Do not change DB schema unless absolutely required.

Constraints: preserve `/worker`, `/admin`, Goliath V1 read-only boundaries;
no live PowerShell from backend/frontend; no frontend-triggered shell exec;
no binaries/dist/node_modules/SQLite DBs in Git; keep local SQLite working;
no auth/mobile/native installer work yet.

## Architecture (current)

- React 18 + Vite + TypeScript frontend (`/app/frontend`)
- Node 20 + Express + TypeScript backend (`/app/backend`)
- better-sqlite3 (local-first); optional ClickUp + SMTP
- Electron desktop shell (untouched in Phase 1)
- Goliath V1 read-only system endpoints under `/api/system/*`

## Phase 1 — completed 2026-01-24

- Frontend `src/lib/api.ts`: resolves API base from
  `import.meta.env.VITE_API_BASE_URL`. Empty/unset → same-origin `/api`.
  Trailing slashes stripped. Exports `API_BASE_URL`. All endpoints
  (including `/api/system/*`) now go through the resolved base.
- Frontend `src/vite-env.d.ts`: typed `VITE_API_BASE_URL`.
- Frontend `src/pages/SetupPage.tsx`: uses `API_BASE_URL` for `/setup` call.
- Backend `src/index.ts`: CORS now configurable via `CORS_ALLOWED_ORIGINS`
  (comma-separated). Dev defaults add common localhost dev origins.
  Production with empty list = loud warning + fail-closed (no
  `Access-Control-Allow-Origin` header → browser blocks cross-origin;
  same-origin still works). Wildcard `*` never used.
- `.env.example`: documented `NODE_ENV`, `VITE_API_BASE_URL`,
  `CORS_ALLOWED_ORIGINS`.
- `docs/DEPLOYMENT_AND_CONFIG.md`: new doc with deployment-mode table,
  env reference, CORS policy summary, and smoke-test checklist for the
  three deployment modes.

### Files changed in Phase 1 PR
- `.env.example`
- `backend/src/index.ts`
- `frontend/src/lib/api.ts`
- `frontend/src/pages/SetupPage.tsx`
- `frontend/src/vite-env.d.ts`
- `docs/DEPLOYMENT_AND_CONFIG.md` (new)

### Validation performed
- `npm run build --prefix backend` ✅
- `npm run build --prefix frontend` ✅ (also with `VITE_API_BASE_URL` set
  — confirmed origin is baked into the bundle)
- `npm run dev` ✅ — backend + Vite both up; `/worker`, `/admin`,
  `/api/health`, and all three `/api/system/*` endpoints return 200/JSON.
- Production single-server (`node backend/dist/index.js`): `/worker`,
  `/admin`, `/api/health`, `/api/system/*` all 200/JSON; bundle uses
  same-origin.
- CORS matrix:
  - dev + allowed origin → `Access-Control-Allow-Origin` echoed
  - dev + disallowed origin → header omitted (browser blocks), no 500
  - prod + empty `CORS_ALLOWED_ORIGINS` → loud warning + no cross-origin
  - prod + listed origin → header echoed; other origins blocked

### V1 constraints — not violated
- `/worker` and `/admin` route handlers unchanged.
- `/api/system/*` endpoints unchanged; still cache/file-read only.
- No live PowerShell, no child-process exec, no frontend-triggered shell.
- No DB schema change.
- `.gitignore` posture intact; no dist/node_modules/sqlite committed.

### Risks
1. Disallowed-origin requests in production return `200 OK` with
   omitted CORS headers (browser-side block) — chosen for clean logs.
   Operators expecting a `403` on the backend will see `200` plus no
   `Access-Control-Allow-Origin`. Documented in
   `docs/DEPLOYMENT_AND_CONFIG.md`.
2. `credentials: true` is set on the CORS middleware. If future hosted
   deployments do not need cookies, this can be tightened later.
3. The Vite dev server still proxies `/api` to `http://localhost:3001`.
   When `VITE_API_BASE_URL` is set during dev, requests will bypass the
   proxy and go to the absolute URL — expected, but worth noting.
4. `docs/FULL_STACK_APP_ROADMAP.md` and `docs/CROSS_PLATFORM_AUDIT.md`
   are **missing from the repo** on `main`. Per user instruction these
   were not invented. Phase 2+ work needs them sourced.

## Backlog (post-Phase 1)

- P1: Source / restore `docs/FULL_STACK_APP_ROADMAP.md` and
  `docs/CROSS_PLATFORM_AUDIT.md`.
- P1: Capacitor (Android/iOS) wrapper track — explicitly deferred.
- P1: Electron overhaul / packaging refresh — explicitly deferred.
- P2: Admin authentication for `/admin` (currently unauthenticated,
  trusted-network only).
- P2: Hosted deployment hardening (rate limits, request size review,
  cookie posture, structured logging).
- P3: Native APK packaging (vs PWA add-to-home).
