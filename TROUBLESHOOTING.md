# FieldPulse Lite Troubleshooting

## App won't start

Open the log file first:

```text
%APPDATA%\FieldPulse Lite\logs\desktop.log
```

If the log says the backend bundle is missing, reinstall FieldPulse Lite or rebuild the installer with:

```powershell
npm run desktop:dist
```

If Windows blocks the app, choose **More info** and **Run anyway** for unsigned local builds.

## Backend port conflict

FieldPulse tries port `3001` first. If it is busy, the desktop app automatically tries the next available port up to `3020`. The chosen port is written to:

```text
%APPDATA%\FieldPulse Lite\logs\desktop.log
```

The setup page and QR code use the selected port, so worker phones should still connect as long as the PC firewall allows the app on the local network.

## Where local data is stored

Packaged desktop app data lives here:

```text
%APPDATA%\FieldPulse Lite\
```

Important files and folders:

```text
%APPDATA%\FieldPulse Lite\.env
%APPDATA%\FieldPulse Lite\data\fieldpulse.sqlite
%APPDATA%\FieldPulse Lite\uploads\
%APPDATA%\FieldPulse Lite\logs\desktop.log
```

From a source checkout, local data stays in:

```text
backend\data\
backend\uploads\
```

## Reset local database safely

1. Close FieldPulse Lite.
2. Make a backup copy of `%APPDATA%\FieldPulse Lite\data\fieldpulse.sqlite` if you might need the records later.
3. Delete these files from `%APPDATA%\FieldPulse Lite\data\`:

```text
fieldpulse.sqlite
fieldpulse.sqlite-shm
fieldpulse.sqlite-wal
```

4. Reopen FieldPulse Lite. A fresh database will be created automatically.

Do not delete `.env` unless you also want to remove email and ClickUp settings.

## How to find logs

Desktop startup and backend boot details are written to:

```text
%APPDATA%\FieldPulse Lite\logs\desktop.log
```

For source checkout browser/server mode, the backend logs print in the `Start-FieldPulse.bat` terminal window.
