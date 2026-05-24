# FieldPulse Cross-Platform Audit

## Snapshot

Audit target: clean merged FieldPulse source history after PR #1.

Current baseline:

- `origin/main`: `742a91e` merge commit
- Clean source commit: `6ad02ae`
- Known-good local checkpoint: `f04f84c`
- Current recommended branch base: `origin/main`

This audit is for planning the next cross-platform work. It is not a bug report against the merged Goliath dashboard.

## What Already Works

### Worker/Admin Web App

FieldPulse already has a shared React/Vite frontend:

- Worker route: `/worker`
- Admin route: `/admin`
- Setup route: `/setup`
- PWA manifest and service worker configuration in the frontend
- Offline queue logic in the frontend

### Backend

FieldPulse already has a Node/Express backend:

- Health endpoint
- Config endpoint
- Logs CRUD-ish endpoints
- Photo upload endpoint
- Reports/email endpoint
- Goliath system status endpoints
- SQLite persistence through `better-sqlite3`

### Desktop

The repo already has an Electron wrapper:

- Starts the bundled backend
- Opens the local setup page
- Stores packaged runtime files under app data
- Builds through Electron tooling

### Goliath V1 Guardrails

The read-only dashboard remains within the intended V1 boundary:

- System status routes use file reads only
- No live PowerShell execution from the dashboard
- No frontend-triggered script execution
- Missing Sentinel/operator/NUDGE files are warning states, not runtime failures

## Current Blockers For Full Cross-Platform Product

| Area | Current State | Why It Matters | Recommended Next Step |
|------|---------------|----------------|-----------------------|
| API URL handling | Frontend dev proxy points to `localhost:3001` | Mobile/native/hosted web cannot rely on localhost | Add explicit frontend API base configuration |
| Data store | SQLite file on the server/desktop host | Good for local mode, not enough for multi-device hosted sync unless deployment supports persistent disk | Decide hosted DB strategy |
| Upload storage | Local filesystem uploads | Hosted/mobile deployments need durable storage | Add storage abstraction or hosted file store plan |
| Auth | No admin login | Hosted admin route would be exposed | Add auth plan before public hosted admin |
| Release pipeline | Manual/local scripts | Installers should be produced outside Git history | Add CI/release workflow plan |
| PowerShell visibility | Several Windows helper scripts and npm scripts call PowerShell | Acceptable for internal Windows build helpers, not ideal as user-facing install path | Move public docs toward npm/installer/CI commands |
| Mobile native shell | Not present yet | PWA works first, but App Store/Play Store need native wrapper | Add Capacitor after API-base work |
| macOS installer | Not present yet | Current desktop track is Windows-first | Add macOS packaging plan after Electron cleanup |

## Local-Only Assumptions Found

### Local Ports

References found:

- `backend/src/index.ts`
- `backend/src/routes/setup.ts`
- `frontend/vite.config.ts`
- `electron/main.js`
- `README.md`

These are fine for local dev and desktop mode. Hosted/mobile mode needs config-driven public URLs.

### SQLite Runtime Files

SQLite is currently a local runtime concern:

- `backend/data/.gitkeep` is tracked
- `backend/data/*.sqlite*` is ignored

This is correct for the clean repo. For hosted multi-device mode, choose whether to:

- Keep SQLite only for local desktop mode
- Add Postgres or another hosted database for cloud mode
- Use a hosted SQLite-compatible service with durable storage

### Uploads

Uploads currently default to local disk. This works for local desktop/server mode but will not be durable across typical stateless hosts.

Follow-up options:

- Keep uploads local for desktop mode
- Add object storage for hosted mode
- Store photos through provider SDK/API, not frontend secrets

### PowerShell

PowerShell appears in:

- Windows packaging scripts
- README examples
- npm release/package scripts

PowerShell does not appear as a backend/frontend runtime dependency for the web app. The next productization step is to stop making PowerShell part of the ordinary user story.

### Electron Child Process

`electron/main.js` uses `node:child_process` to start the local backend. This belongs to the desktop wrapper, not the hosted backend or Goliath dashboard route path.

Keep this distinction clear:

- Desktop wrapper may manage a local backend process
- Hosted backend must not expose shell/process execution routes
- Frontend must never trigger shell execution

## Suggested PR Backlog

### PR 1: Production Configuration And API Base

Goal:

Make the web app able to run against either local dev, local desktop, or hosted API.

Tasks:

- Add `VITE_API_BASE_URL` handling in `frontend/src/lib/api.ts`
- Keep same-origin API calls as the default
- Document local, hosted, and desktop modes
- Add a smoke-test checklist for each mode

### PR 2: Backend Production Config Guardrails

Goal:

Make backend startup safer and easier to reason about.

Tasks:

- Centralize config parsing
- Warn or fail clearly when required production env vars are missing
- Make CORS environment-driven
- Document secrets and runtime data paths

### PR 3: Auth Plan And Admin Protection

Goal:

Prepare for hosted admin access without exposing logs publicly.

Tasks:

- Decide auth provider/session strategy
- Protect `/admin` in hosted mode
- Keep `/worker` simple for field users
- Document whether worker submissions need a shared code, QR token, or no auth

### PR 4: Hosted Storage Strategy

Goal:

Separate local desktop storage from hosted production storage.

Tasks:

- Decide database target
- Define migration approach
- Add upload/photo storage plan
- Keep local SQLite mode working

### PR 5: PWA Production Hardening

Goal:

Make install-from-browser reliable enough for V1 field use.

Tasks:

- Verify manifest on Android and iOS
- Verify service worker behavior
- Confirm offline queue retry semantics
- Add install docs with screenshots later

### PR 6: Capacitor Mobile Shell

Goal:

Package the existing web app as Android/iOS shells.

Tasks:

- Add Capacitor config
- Add Android project
- Add iOS project when macOS/Xcode is available
- Configure icons/splash screens
- Use hosted API URL, not localhost

### PR 7: Desktop Installer Cleanup

Goal:

Keep desktop packaging normal and artifact-safe.

Tasks:

- Ensure release artifacts are ignored
- Publish installers through GitHub Releases/CI artifacts
- Add macOS package path
- Reduce user-facing PowerShell references

## Ten-Minute Verification Checklist

Run after any platform-readiness PR:

```powershell
git status --short --branch
npm run build --prefix backend
npm run build --prefix frontend
npm run build --prefix canonical-hub
npm run dev
```

Check:

- `GET http://localhost:3001/api/health`
- `GET http://localhost:3001/api/system/sentinel`
- `GET http://localhost:3001/api/system/canonical-status`
- `GET http://localhost:3001/api/system/operator-health`
- `http://localhost:5173/admin`
- `http://localhost:5173/worker`

Expected V1 warnings:

- Missing Sentinel snapshot
- Missing cached Operator host snapshot
- Missing `NUDGE_GLANCE.md`

These warnings are acceptable unless the specific task is to generate those CANONICAL artifacts.

