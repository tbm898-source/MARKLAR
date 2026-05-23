Architect-operator automation (Windows / PowerShell 5.1+)

Run from the operatoros-executable-template folder:

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/architect-operator/Invoke-ArchitectOperatorReport.ps1

Or double-click: scripts/architect-operator/Run-ArchitectOperatorReport.cmd (pass switches after a space in a cmd window if needed).

Environment:
  CANONICAL_ROOT   Override path to your CANONICAL folder (default: %USERPROFILE%\Dropbox\CANONICAL if it exists)

Useful switches:
  -RefreshTailscalePdf   Regenerate 01_OPS/PRINTS/Tailscale_Home_Setup_Checklist.pdf via Edge (headless)
  -OpenInbox             Open Downloads inbox in Explorer
  -Weekly                Echo weekly reset steps (still manual in MASTER_TASKS / inbox)
  -RecentHours 48        Change the "recent files" window (default 24)

Optional: copy this folder to CANONICAL\01_OPS\architect-operator\ and point a Scheduled Task at the same command if you want a morning status log without opening the template repo.

Triage manifest (for the inbox triage agent):

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/architect-operator/Export-InboxTriageManifest.ps1 -IncludeScreenshots

Naming / folder map: see canonical-support\NAMING_CONVENTIONS.md and CANONICAL_MAP.md in the template repo (copy into CANONICAL\01_OPS\ if you want them beside tasks).

Daily automation (reliable):
  1) One-time: powershell -File scripts\architect-operator\Register-CanonicalDailyScheduledTask.ps1
     (creates task "CANONICAL Daily Routine", default 07:00; use -DailyAt 06:30 to change)
     If scripts live only in this repo, registration auto-points at scripts\architect-operator\Invoke-DailyCanonicalRoutine.ps1 when CANONICAL\01_OPS\architect-operator\ copy is missing.
  2) Every run writes: CANONICAL\01_OPS\REMINDERS\LAST_DAILY_RUN.md (read this; answers only if questions apply)
     Also seeds or reads 01_OPS\REMINDERS\NUDGES_STANDING.md and echoes its bullet lines into LAST_DAILY_RUN (meat-brain nudges + ai-council cue).
  3) Manual same as scheduled: Invoke-DailyCanonicalRoutine.ps1  (add -OpenReminder to open in VS Code or Notepad)

Nudge pulse (optional, distraction-friendly):
  1) Edit NUDGES_STANDING.md (template: scripts\architect-operator\NUDGES_STANDING.template.md)
  2) One-time: powershell -File scripts\architect-operator\Register-CanonicalNudgePulseTask.ps1
     Default times 10:00,13:00,16:00,19:00 — use -Times '09:00,12:30,...' to customize
  3) Each run updates CANONICAL\01_OPS\REMINDERS\NUDGE_GLANCE.md (one rotating line)
  4) Manual: powershell -File scripts\architect-operator\Invoke-CanonicalNudgePulse.ps1 -OpenGlance

Sentinel visibility (git + CANONICAL + tasks + host in one Markdown file):
  See scripts\sentinel\README.txt  (writes 01_OPS\REMINDERS\SENTINEL_LAST.md + JSON log line)
