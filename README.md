# FieldPulse Lite

A **local-first, phone-first** field logging app for workers. Workers tap one of three big buttons, fill a short form, and see **"Saved. Thank you."** Entries save to SQLite on your server. **Email reports** notify you on each submission (recommended). **ClickUp is optional** â€” add it later when ready.

- **Worker UI:** `/worker` â€” kiosk-style, no technical language
- **Admin UI:** `/admin` â€” view logs, email reports, QR links
- **Desktop app:** Electron shell that starts the local backend and opens FieldPulse
- **Windows installer:** normal Start Menu / desktop shortcut install; no Node.js required on the installed PC
- **Android phones:** local web/PWA-capable worker interface over Wi-Fi; no app store required
- **No ClickUp required** to start

## Quick start (Windows â€” one-time install)

**Using the Windows installer:**

1. Run **`FieldPulse-Lite-Setup-1.0.0.exe`** from `electron\dist` or from a prepared `release\FieldPulse-Lite-Windows` folder.
2. Open **FieldPulse Lite** from the desktop or Start Menu.
3. The desktop app starts the local backend automatically and opens the setup page with a **QR code**.

Node.js is **not required** on the installed PC. The packaged app runs the backend inside Electron.

**From this source checkout:**

1. Install [Node.js LTS](https://nodejs.org) if you do not have it.
2. Double-click **`Install-FieldPulse.bat`** (wait until it finishes).
3. Double-click **`Start-FieldPulse-Desktop.bat`** for the desktop app, or **`Start-FieldPulse.bat`** for browser/server mode.

**On worker phones (no app store):**

1. Phone must be on the **same Wi-Fi** as the PC.
2. Scan the QR code on the setup page (or type the URL shown).
3. Optional: **Add to Home Screen** for a full-screen icon (Safari / Chrome).

Workers do **not** download anything from an app store. Android phones use the local worker web app and can add it to the home screen.

**Share with another PC:** build the installer with `npm run desktop:dist`, then share `electron\dist\FieldPulse-Lite-Setup-1.0.0.exe`. For a handoff folder with docs, run `npm run package:windows` after building.

---

## 1. What this app does

1. Worker opens the app on a phone (browser or installed PWA).
2. Worker chooses: **I Did Something**, **I Found a Problem**, or **I Need Something**.
3. Worker fills 4â€“5 simple fields (name, site, short description).
4. The backend saves the record in SQLite (status: **saved locally**).
5. If email is configured, you get an email for each new entry.
6. Optionally, if ClickUp is configured, a task is created too.

## 2. Install From Source

Requirements for building from source: **Node.js 18+**, npm.

```powershell
cd "C:\Users\Tim Milkewicz\Dropbox\fieldpulse"
copy .env.example .env
# Edit .env â€” email settings (section 3). ClickUp optional (section 4).

npm run install:all
npm run db:init
```

## 3. Email setup (recommended â€” no ClickUp needed)

Use any SMTP provider (Gmail, Outlook, SendGrid, etc.). Example for **Gmail**:

1. Turn on 2-factor auth for your Google account.
2. Create an **App Password**: Google Account â†’ Security â†’ App passwords.
3. In `.env`:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=you@gmail.com
SMTP_PASS=your_16_char_app_password
SMTP_FROM=FieldPulse Lite <you@gmail.com>
REPORT_EMAIL_TO=you@gmail.com
```

**What happens:**
- Each worker submission â†’ email to `REPORT_EMAIL_TO`
- Admin page â†’ **Email report** button sends a summary table

**Without email:** the app still works. Entries save locally; the server logs new entries to the console.

## 4. ClickUp setup (optional â€” add later)

Skip this section until you want ClickUp tasks. Leave these blank in `.env`:

```env
CLICKUP_API_TOKEN=
CLICKUP_LIST_ID=
```

### How to get a ClickUp API token

1. Log in to [ClickUp](https://app.clickup.com).
2. Click your avatar â†’ **Settings** â†’ **Apps** (or **Integrations**).
3. Under **API Token**, click **Generate** or copy your personal token.
4. Put it in `.env` as `CLICKUP_API_TOKEN=pk_...`

**Never** put this token in frontend code or commit `.env` to git.

### How to get a ClickUp List ID

1. Open the List where tasks should be created.
2. Look at the URL: `https://app.clickup.com/.../v/li/XXXXXXXX`
3. `XXXXXXXX` is your **List ID** â†’ set `CLICKUP_LIST_ID=XXXXXXXX` in `.env`

## 5. Run the app

From the repo root (with `.env` configured):

```powershell
npm run dev
```

Backend only (port 3001):

```powershell
cd backend
npm run dev
```

Health check: `http://localhost:3001/api/health`

**Development** â€” from repo root, `npm run dev` starts backend + frontend:

- Worker: `http://localhost:5173/worker`
- Admin: `http://localhost:5173/admin`

**Production** (single server):

```powershell
npm run build
npm run start
```

Then open `http://localhost:3001/worker` (backend serves the built frontend).

## 6. Desktop app / Windows installer

Source checkout local desktop app:

```powershell
npm run install:all
npm run build
npm run desktop:start
```

Build a Windows installer:

```powershell
npm run desktop:dist
```

Installer output is written to `electron\dist\FieldPulse-Lite-Setup-1.0.0.exe` and is intentionally ignored by Git.
The generated Electron installer does not require Node.js on the installed PC; it runs the bundled backend inside Electron's main process.

Create a shareable release folder after the installer exists:

```powershell
npm run package:windows
```

That writes `release\FieldPulse-Lite-Windows` with the installer and the key setup/troubleshooting docs. The `release` folder is also ignored by Git.

When launched from this source checkout, the desktop app uses the project `.env`, `backend\data`, and `backend\uploads`. The packaged installer stores its editable `.env`, SQLite database, and uploads under the Windows app data folder for **FieldPulse Lite**. ClickUp and email still run only in the backend process.

See [TROUBLESHOOTING.md](TROUBLESHOOTING.md) for startup issues, logs, port conflicts, and database reset steps.

## 7. Open on Android / phones over local Wi-Fi

**Easiest with the installer:** open FieldPulse Lite on the PC and scan the QR code on the setup page.

**From source:** run `Start-FieldPulse.bat` and use **http://localhost:3001/setup** â€” scan the QR code.

1. Connect phone and PC to the **same Wi-Fi** (not guest Wi-Fi).
2. Allow FieldPulse Lite through Windows Firewall when prompted.
3. On the phone, scan the QR or open `http://YOUR-PC-IP:3001/worker` (IP shown on setup page).
4. In Chrome on Android, choose **Add to Home screen** for an app-like icon. Chrome may show **Install app** when the page is served from an origin it treats as installable.

**Dev mode** uses port 5173 instead (`npm run dev`) â€” for phone testing, prefer `Start-FieldPulse.bat` (production, one port).

See [ANDROID.md](ANDROID.md) for the Android compatibility notes and native APK tradeoffs.

## 8. QR codes for worker / action links

Use the **QR generator** on `/admin`, or any QR tool with URLs like:

| URL | Behavior |
|-----|----------|
| `/worker?worker=Andrew%20Peck` | Prefill worker name |
| `/worker?action=work_done` | Open "I Did Something" form |
| `/worker?worker=Tim&action=problem_found` | Prefill + open problem form |
| `/worker?worker=Andrew%20Peck&action=need_item` | Prefill + open need form |

Full dev example: `http://192.168.1.42:5173/worker?worker=Tim&action=work_done`

Action values: `work_done`, `problem_found`, `need_item`

## 9. Retry failed sync

1. Open `/admin`.
2. Filter **Status** â†’ `failed` (or `pending`).
3. Click **Retry sync** on a row.
4. On success, status becomes `synced` and a ClickUp link appears.

Records are **never deleted** when sync fails.

## 10. Known limitations

- **No admin login** â€” protect `/admin` on a trusted network or add auth later.
- **ClickUp is optional** â€” email + local SQLite is enough for MVP.
- **Single ClickUp list** when enabled â€” all tasks go to `CLICKUP_LIST_ID`.
- **No ClickUp custom fields** in MVP â€” see [CLICKUP_CUSTOM_FIELDS.md](CLICKUP_CUSTOM_FIELDS.md).
- **Photos** are optional; upload may be skipped without blocking submit.
- **Offline queue** on the device retries when the API is reachable; server DB is the source of truth after sync.
- **Android is local web/PWA-first** â€” native APK packaging is a later wrapper track if you need Play Store-style distribution.
- Workers do not need ClickUp accounts.

## Default workers and sites

Edit [`backend/src/config/defaults.ts`](backend/src/config/defaults.ts) to change dropdown options.

**Workers:** Tim, Andrew Peck, Andrew Herman, Other  
**Sites:** Main Site, Old Charleston School, Baloni Ranch, SE Site, Work Truck, Other

## Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install root, backend, frontend deps |
| `npm run db:init` | Create SQLite DB and tables |
| `npm run dev` | Run backend + frontend (dev) |
| `npm run build` | Build frontend + backend |
| `npm run start` | Production server (port 3001) |
| `npm run desktop:dist` | Build the Windows installer |
| `npm run package:windows` | Create an ignored release folder containing the installer and docs |

## API routes

- `GET /api/health`
- `GET /api/config`
- `POST /api/logs`
- `GET /api/logs`
- `GET /api/logs/:id`
- `POST /api/logs/:id/retry-sync`
- `POST /api/logs/:id/mark-reviewed`
- `POST /api/upload-photo`
- `GET /api/system/sentinel`
- `GET /api/system/operator-health`
- `GET /api/system/canonical-status`

## Goliath Control Plane / System Dashboard

FieldPulse Lite / OperatorOS Tracker includes a read-only admin system dashboard for CANONICAL and operator visibility.

What it adds:
- A new System / Goliath section inside the existing `/admin` screen
- Sentinel snapshot visibility from `CANONICAL/01_OPS/REMINDERS/SENTINEL_LAST.md`
- CANONICAL reminder/log status checks
- Operator host health based on approved cached snapshot/log output when available

Configuration resolution order:
1. `CANONICAL_ROOT`
2. `%USERPROFILE%/Dropbox/CANONICAL`
3. `not_configured`

Security boundaries:
- V1 is read-only
- V1 operator health is cache/file-read only
- No PowerShell is executed live from the dashboard
- No backend script spawning is used for V1 operator health
- No frontend-triggered execution is allowed
- No arbitrary shell execution is exposed
- No user-supplied filesystem paths are accepted
- Existing worker/admin logging flow remains unchanged
- SQLite remains unchanged
- Secrets stay server-side only

## Full-Stack / Cross-Platform Roadmap

The next product track is documented in:

- [Full-stack app roadmap](docs/FULL_STACK_APP_ROADMAP.md)
- [Cross-platform audit](docs/CROSS_PLATFORM_AUDIT.md)
- [Deployment and configuration](docs/DEPLOYMENT_AND_CONFIG.md)

Short version: keep one shared React app, use a hosted backend for true multi-device sync, use Capacitor for Android/iPhone when ready, keep Electron for Windows/macOS desktop packaging, and keep generated installers out of Git history.
