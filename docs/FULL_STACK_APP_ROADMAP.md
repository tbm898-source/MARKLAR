# FieldPulse Full-Stack App Roadmap

## Goal

Turn FieldPulse Lite from a local-first Windows/phone helper into a full-stack product that can run cleanly on:

- Web browsers on phones, tablets, PCs, and Macs
- Android
- iPhone/iPad
- Windows desktop
- macOS desktop

The product should keep one shared worker/admin experience, avoid user-facing PowerShell, and ship through normal install paths.

## Product Owner Decisions

These are the human decisions before engineering gets too clever.

1. First audience:
   - Solo/internal use
   - Crew/student use
   - Customer-facing product later

2. Data home:
   - Local-only on one PC
   - Hosted backend so all devices sync
   - Hybrid local/offline-first with hosted sync

3. Mobile distribution:
   - PWA first
   - Android APK/TestFlight next
   - Play Store/App Store later

4. First shippable workflow:
   - Worker opens FieldPulse on phone
   - Worker logs work/problem/need item
   - Optional photo upload
   - Admin sees the entry on desktop
   - Admin can email/export/report

## Recommended Architecture

Use one shared app surface with thin platform wrappers.

```text
React/Vite frontend
        |
        | HTTPS API
        v
Node/Express backend
        |
        v
Production database + file/photo storage
```

Platform shells:

- Web/PWA: the same React app served over HTTPS
- Android/iOS: Capacitor wrapper around the web app
- Windows/macOS: Electron desktop wrapper using the same frontend/backend contract

This avoids maintaining separate Android, iPhone, desktop, and web apps.

## Platform Strategy

### Web/PWA

Use this as the first cross-device delivery target.

- Works on Android, iPhone, PC, and Mac through the browser
- Keeps QR setup and worker links useful
- Can be installed to home screen on supported browsers
- Should be served over HTTPS for production

### Android And iPhone

Use Capacitor as the mobile shell once the hosted API exists.

- Android build target: APK for testing, AAB for Play Store
- iOS build target: TestFlight first, App Store later
- Native permissions likely needed:
  - Camera/photos
  - Network
  - Possibly local notifications later

Do not fork the worker UI unless mobile testing proves a specific issue.

### Windows And Mac

Keep Electron for the first desktop track because the repo already has it.

- Windows installer: Electron Builder NSIS or MSI/MSIX later
- macOS package: DMG/ZIP first, signed/notarized later
- Generated binaries must go to release artifacts, not Git history

Longer term, Tauri can be evaluated, but switching frameworks is not the first priority.

## No Obvious PowerShell Policy

PowerShell can remain as internal legacy helper tooling, but the user path should not depend on it.

User-facing install/run paths should be:

- npm scripts for developers
- normal Windows/macOS installers for desktop users
- browser/PWA install for web users
- Android/iOS app install for mobile users
- GitHub Actions or another CI runner for release builds

Target outcomes:

- No worker/admin runtime executes PowerShell
- No frontend-triggered shell execution
- No backend endpoint starts arbitrary local scripts
- Build and package tasks can be invoked through npm or CI
- Generated release artifacts stay ignored and are uploaded to releases/CI artifacts

## Phased Plan

### Phase 0: Keep The Clean Repo Clean

Definition of done:

- `origin/main` remains the clean merged source history
- No `.exe`, `dist-release`, `win-unpacked`, `node_modules`, `dist`, or runtime DB files enter Git
- Future work branches start from `origin/main`
- Existing backups remain archived until a clean clone builds and runs

### Phase 1: Production Shape Without Rewriting The App

Definition of done:

- Frontend can target a configurable API base URL
- Backend has clear production config validation
- CORS is explicit and environment-driven
- Server startup docs distinguish local desktop, hosted API, and dev mode
- Runtime data paths are documented and testable
- Admin route has an auth plan, even if auth is implemented in a later PR

### Phase 2: Hosted Backend

Definition of done:

- Backend can run on a hosted Node platform
- Database choice is selected:
  - Keep SQLite for local desktop mode
  - Add Postgres for hosted multi-device mode, or choose a hosted SQLite-compatible provider
- Schema migrations are formalized
- Upload/photo storage moves from local disk to a production storage plan
- Secrets are server-side only

### Phase 3: Web/PWA Release

Definition of done:

- HTTPS web deployment exists
- PWA manifest and service worker are verified on Android and iOS
- Offline queue behavior is documented
- Worker flow works on phone browser
- Admin flow works on desktop browser

### Phase 4: Mobile Native Shells

Definition of done:

- Capacitor project added without rewriting the React app
- Android debug build runs
- iOS simulator/TestFlight path is documented
- App icons and splash screens are configured
- Camera/photo permissions are verified if photo upload is in scope
- Mobile builds talk to the hosted API, not `localhost`

### Phase 5: Desktop Release

Definition of done:

- Electron build works from clean source
- Windows installer builds without checked-in binaries
- macOS package path is documented
- Desktop app has clear data storage behavior
- Release artifacts publish to GitHub Releases or CI artifacts
- Code signing/notarization plan exists

### Phase 6: Release Pipeline

Definition of done:

- CI runs backend build
- CI runs frontend build
- CI runs smoke tests for API endpoints
- Optional release workflow builds desktop installers
- Mobile release workflow is documented, even if manual initially

## AI Council Work Lanes

### Architect

Owns architecture decisions and boundary checks.

Prompt:

```text
Review docs/FULL_STACK_APP_ROADMAP.md and docs/CROSS_PLATFORM_AUDIT.md.
Propose the smallest architecture path to make FieldPulse run on web, Android, iPhone, Windows, and Mac while preserving the current worker flow.
Call out decisions the human must make and avoid recommending a rewrite unless a specific blocker requires it.
```

### Verifier

Owns constraint checking.

Prompt:

```text
Audit the repo for violations of the full-stack roadmap guardrails:
no user-facing PowerShell requirement, no generated binaries in Git, no frontend shell execution, no live PowerShell from backend routes, no worker flow regressions, and no accidental SQLite/runtime DB commits.
Return findings with exact files and lines.
```

### Implementer

Owns PR-sized changes.

Prompt:

```text
Turn the roadmap into small PR-sized tasks.
Start with configuration cleanup and production API-base support.
Do not touch mobile wrappers or packaging until the current web/backend contract is clean.
```

### Mobile Specialist

Owns Capacitor planning.

Prompt:

```text
Design the Capacitor Android/iOS wrapper plan for the existing Vite React frontend.
List required config, build commands, permissions, icon/splash assets, API URL handling, and test devices.
Do not rewrite the worker UI unless a mobile-specific bug requires it.
```

### Release Engineer

Owns installers and artifacts.

Prompt:

```text
Design the release pipeline for FieldPulse.
Generated installers and mobile builds must stay out of Git history.
Prefer GitHub Releases or CI artifacts.
Replace public-facing PowerShell install/build instructions with npm or CI-driven commands where practical.
```

## First PR Recommendation

Start with a boring, high-leverage cleanup PR:

```text
Production configuration and platform readiness
```

Scope:

- Add `VITE_API_BASE_URL` support for the frontend
- Add backend config validation for production mode
- Document local desktop vs hosted API modes
- Add a short no-user-facing-PowerShell policy to README/docs
- Add smoke-test commands that do not require platform installers

Avoid in the first PR:

- Capacitor project creation
- Electron packaging overhaul
- Database migration
- Auth implementation
- App Store/Play Store work

