# Architect-Operator and Tasks for Cursor

As the **architect-operator**, we unify systems and processes to turn chaos into usable infrastructure. The goal is to uphold a **single source of truth** and emphasize **authority**, **cadence**, and **closed loops**.

---

## Daily / weekly tasks (checklist)

- [ ] **Print** Tailscale Home Subnet-Router Setup Checklist (see §1).
- [ ] **Confirm** the nightly sweep ran (see §2).
- [ ] **Perform** the daily 12-minute triage (see §3; triage + naming agents in Cursor).
- [ ] **Run** the weekly reset: pick three outcomes, promote tasks, triage inbox, archive clutter (see §4).

---

## 1. Print Tailscale Home Subnet-Router Setup Checklist

1. Locate the file: `CANONICAL/01_OPS/Tailscale_Home_Setup_Checklist.md`
2. Open it, print in color using the home network printer.
3. Save a PDF copy to: `CANONICAL/01_OPS/PRINTS/Tailscale_Home_Setup_Checklist.pdf`

---

## 2. Confirm Nightly Sweep

1. Check `CANONICAL/00_INBOX/Downloads` and `CANONICAL/00_INBOX/Screenshots` for new files modified since the sweep’s usual run time (or roughly the last 18–24 hours if you triage at a different time of day).
2. If **both** folders contain **zero files** (nothing accumulated to sweep), open **Task Scheduler** and verify that **CANONICAL Inbox Sweep** shows a recent **Last Run Time** and **Last Result** `0`.
3. **Automation:** run `scripts/architect-operator/Invoke-ArchitectOperatorReport.ps1` from this repo (or copy that folder into `CANONICAL/01_OPS/` if you prefer it beside `inbox_sweep.ps1`). Set environment variable `CANONICAL_ROOT` if your tree is not `%USERPROFILE%\Dropbox\CANONICAL`. The script prints inbox counts, recent activity, and sweep-task status, and appends the same to `CANONICAL/01_OPS/LOGS/architect_operator_YYYY-MM-DD.log`. Optional switches: `-RefreshTailscalePdf`, `-OpenInbox`, `-Weekly` (prints the weekly reset checklist).
4. **Daily routine (scheduled):** register once with `Register-CanonicalDailyScheduledTask.ps1` (default **07:00**). Task **CANONICAL Daily Routine** runs `Invoke-DailyCanonicalRoutine.ps1`: same report + fresh triage manifest + overwrites `CANONICAL/01_OPS/REMINDERS/LAST_DAILY_RUN.md` with status and short questions (sweep failure, large inbox). Read that file when you open the machine; optional `-OpenReminder` if you run the routine manually and want Cursor/Notepad to open.

---

## 3. Daily 12-Minute Triage

1. Open `00_INBOX` (`Downloads` and optionally `Screenshots`).
2. Run `scripts/architect-operator/Export-InboxTriageManifest.ps1` (add `-IncludeScreenshots` if needed). It writes `CANONICAL/01_OPS/LOGS/triage_manifest_*.md`.
3. In Cursor, enable the **canonical-inbox-triage** rule and attach the latest manifest. The agent proposes **MOVE / RENAME / DELETE / REVIEW** with paths under **`02_PROJECTS/`**, **`03_AREAS/`**, **`04_ASSETS/`**, or **`90_REVIEW/`** (see `canonical-support/CANONICAL_MAP.md`). You approve before any bulk moves execute.
4. For systematic renames elsewhere in the tree, use the **canonical-naming** rule with `canonical-support/NAMING_CONVENTIONS.md`.
5. Merge any suggested next actions into `CANONICAL/01_OPS/MASTER_TASKS.md` (**P1** / **P2** / **P3**).

---

## 4. Weekly Reset Procedure

At the start of each week:

1. Pick **exactly three outcomes** to prioritize. Examples:
   - Finish cutting the first sub and begin assembly with students; if possible complete assembly.
   - Continue student-led wood shop work and document evidence.
   - Prepare for next Monday’s annual employee evaluation.
2. **Promote** tasks supporting these outcomes to **P1** / **P2** in `CANONICAL/01_OPS/MASTER_TASKS.md`.
3. **Empty and triage** the entire inbox.
4. **Archive** completed projects and clutter.

---

## 5. Architect-Operator concept summary

The architect-operator is the **builder of systems** and the **keeper of the doctrine**. They design and manage the operating system for the user’s life.

- They prioritize **single sources of truth**, enforce **cadence**, and ensure each **loop is closed**.
- They operate with **authority**, unify doctrine across tasks, and transform disorder into **repeatable workflows**.
