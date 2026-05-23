# OperatorOS Tracker → Windows EXE (Electron)

This folder contains:
- /pwa  : the local-first OperatorOS Tracker (HTML/CSS/JS)
- /electron : an Electron wrapper that can build a Windows installer .exe

## Build on Windows 10/11 (your Dell G16)

1) Install Node.js (LTS). Then restart your terminal.
2) Open PowerShell in THIS folder (operatoros-executable-template).

3) Build:

   cd electron
   npm install
   npm run dist

4) Output:
   electron/dist/OperatorOS Tracker Setup 1.0.0.exe  (name may vary slightly)

## Run in dev mode

   cd electron
   npm install
   npm start

## Integrations

- `integrations/classroom-chatgpt-bridge/` — OpenAI API + Google Classroom with AYA content gate. See `integrations/classroom-chatgpt-bridge/README.md`.

## Architect-operator (CANONICAL automation)

Daily inbox + sweep health + optional Tailscale PDF: see `scripts/architect-operator/README.txt` and `Architect-Operator-and-Tasks-for-Cursor.md`. In Cursor: **architect-operator** (report script), **operator** (host/link/Tailscale snapshot: `scripts/operator/README.txt`), **canonical-inbox-triage** (manifest-driven filing), **canonical-naming** (rename standardization). Naming doctrine: `canonical-support/NAMING_CONVENTIONS.md` and `CANONICAL_MAP.md`.

## AI Council (multi-agent)

Deliberation roles, Verifier pass, council brief template: `canonical-support/AI_COUNCIL_DOCTRINE.md`. In Cursor, enable rule **ai-council** when running a multi-agent session. Morning **LAST_DAILY_RUN.md** and optional **Nudge Pulse** task echo council + your `NUDGES_STANDING.md` lines — see `scripts/architect-operator/README.txt`.

**Sentinel visibility:** one combined git + CANONICAL + tasks + host pane — `scripts/sentinel/README.txt` (writes `CANONICAL/01_OPS/REMINDERS/SENTINEL_LAST.md` when CANONICAL resolves).

**Ingestion & digestion:** trust tiers (what may become action) and extra fallback streams — `canonical-support/INGESTION_AND_DIGESTION.md`.

## Push fails with Permission denied (publickey)?

Windows SSH fix checklist: `scripts/git/FIX-GITHUB-PUSH-WINDOWS.txt` (ssh-agent, `ssh-add`, or HTTPS + sign-in).

## Push this repo to GitHub (first time)

1. On github.com: New repository, empty, no README (you already have commits here).
2. Copy the HTTPS URL (e.g. https://github.com/YOU/REPO.git).
3. From this folder in PowerShell:

   .\scripts\add-github-remote-and-push.ps1 -RemoteUrl "https://github.com/YOU/REPO.git"

   If GitHub’s default branch is `main` and yours is `master`, either rename locally (`git branch -M main`) or push with:

   .\scripts\add-github-remote-and-push.ps1 -RemoteUrl "https://github.com/YOU/REPO.git" -Branch main

   (after `git branch -M main` once).

## Notes
- Data is stored locally on the machine (Electron uses Chromium localStorage for the loaded files).
- Replace the placeholder icons in /pwa/icons with real 192/512 PNGs.
