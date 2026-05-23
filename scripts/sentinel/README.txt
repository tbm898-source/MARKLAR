Sentinel visibility (one pane of truth)
=======================================

What it does
------------
Single run aggregates:

  - Git: branch, origin URL, ``git status -sb``
  - CANONICAL: root, inbox file counts, LAST_DAILY_RUN / NUDGE_GLANCE mtimes (if present)
  - Task Scheduler: ``CANONICAL Inbox Sweep`` + ``CANONICAL Daily Routine`` last/next/result
  - Host: output of ``scripts/operator/Invoke-OperatorHostSnapshot.ps1`` (Tier A JSON, folded into the snapshot)

Outputs
-------
  - **Stdout:** one JSON line (machine-readable).
  - **If CANONICAL resolves:** append JSON to ``01_OPS/LOGS/sentinel_visibility_YYYY-MM-DD.log`` and overwrite ``01_OPS/REMINDERS/SENTINEL_LAST.md`` (pin this file in Cursor or Explorer).

Run (from OperatorOS repo root)
--------------------------------
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sentinel/Invoke-SentinelVisibilitySnapshot.ps1

  -GitRepoRoot "D:\path\to\MARKLAR"     if .git is not two levels above /scripts/sentinel
  -CanonicalRoot "D:\path\to\CANONICAL"  if not using CANONICAL_ROOT / Dropbox default
  -NoLog                                 stdout JSON only (no SENTINEL_LAST / log append)
  -OpenResult                            open SENTINEL_LAST.md after write

Optional schedule
-----------------
  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sentinel/Register-SentinelVisibilityTask.ps1

Uses the same ``CANONICAL_ROOT`` / Dropbox resolution as other scripts. Pass ``-GitRepoRoot`` if your clone is not the default relative path.

Ambient signals (staleness + recent inbox names only, no contents)
--------------------------------------------------------------------
When daily reminders are skipped, run:

  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sentinel/Invoke-AmbientSignalsSnapshot.ps1

Outputs JSON to stdout and appends to ``01_OPS/LOGS/ambient_signals_YYYY-MM-DD.log`` (unless ``-NoLog``).
Includes: ages of LAST_DAILY_RUN / SENTINEL_LAST / NUDGE_GLANCE, ``cadenceDebt`` booleans, latest triage manifest mtime,
and the newest ``-RecentFileLimit`` inbox files (relative paths + size only).

Trust tiers and digestion gates: ``canonical-support/INGESTION_AND_DIGESTION.md``
