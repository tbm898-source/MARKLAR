#Requires -Version 5.1
<#
.SYNOPSIS
  Daily automation: architect report + triage manifest + one reminder file for you to read.

.NOTES
  Intended to run from Task Scheduler (see Register-CanonicalDailyScheduledTask.ps1).
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [string]$SweepTaskName = 'CANONICAL Inbox Sweep',
  [int]$ManifestCount = 30,
  [int]$LargeInboxTotalWarn = 800,
  [switch]$OpenReminder
)

$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}

function Get-InboxCount {
  param([string]$path)
  if (-not (Test-Path -LiteralPath $path)) { return 0 }
  (Get-ChildItem -LiteralPath $path -File -Force | Measure-Object).Count
}

function Get-InboxRecent {
  param([string]$path, [datetime]$since)
  if (-not (Test-Path -LiteralPath $path)) { return 0 }
  (Get-ChildItem -LiteralPath $path -File -Force | Where-Object { $_.LastWriteTime -ge $since } | Measure-Object).Count
}

function Get-SweepBrief {
  param([string]$Name)
  try {
    $task = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -eq $Name } | Select-Object -First 1
    if (-not $task) { return @{ Ok = $false; Detail = 'task not found'; LastRun = $null; Result = $null; NextRun = $null; State = '' } }
    $info = Get-ScheduledTaskInfo -InputObject $task
    $ok = ($info.LastTaskResult -eq 0)
    return @{
      Ok         = $ok
      LastRun    = $info.LastRunTime
      Result     = $info.LastTaskResult
      NextRun    = $info.NextRunTime
      State      = $task.State.ToString()
    }
  }
  catch {
    return @{ Ok = $false; Detail = $_.Exception.Message }
  }
}

# 1) Report (appends architect_operator_*.log)
& (Join-Path $here 'Invoke-ArchitectOperatorReport.ps1') -CanonicalRoot $CanonicalRoot | Out-Null

# 2) Fresh triage manifest for Cursor agent
& (Join-Path $here 'Export-InboxTriageManifest.ps1') -CanonicalRoot $CanonicalRoot -Count $ManifestCount -IncludeScreenshots | Out-Null

$since24 = (Get-Date).AddHours(-24)
$dlPath = Join-Path $CanonicalRoot '00_INBOX\Downloads'
$ssPath = Join-Path $CanonicalRoot '00_INBOX\Screenshots'
$dlTotal = Get-InboxCount $dlPath
$ssTotal = Get-InboxCount $ssPath
$dlRecent = Get-InboxRecent $dlPath $since24
$ssRecent = Get-InboxRecent $ssPath $since24
$sweep = Get-SweepBrief $SweepTaskName

$logDir = Join-Path $CanonicalRoot '01_OPS\LOGS'
$latestManifest = Get-ChildItem -LiteralPath $logDir -Filter 'triage_manifest_*.md' -File -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -First 1

$reminderDir = Join-Path $CanonicalRoot '01_OPS\REMINDERS'
New-Item -ItemType Directory -Force -Path $reminderDir | Out-Null
$nudgePath = Join-Path $reminderDir 'NUDGES_STANDING.md'
if (-not (Test-Path -LiteralPath $nudgePath)) {
  $templatePath = Join-Path $here 'NUDGES_STANDING.template.md'
  if (Test-Path -LiteralPath $templatePath) {
    Copy-Item -LiteralPath $templatePath -Destination $nudgePath
  }
  else {
    @'
# Standing nudges (edit anytime)

- [ ] One breath before inbox
- [ ] One primary outcome for this block
- [ ] Heavy session? ai-council + one brief first
'@ | Set-Content -LiteralPath $nudgePath -Encoding UTF8
  }
}
$reminderFile = Join-Path $reminderDir 'LAST_DAILY_RUN.md'
$when = Get-Date -Format 'yyyy-MM-dd HH:mm'

$lines = @()
$lines += "# CANONICAL daily run"
$lines += ""
$lines += "**When:** $when  "
$lines += ""
$lines += "## Status (auto)"
$lines += ""
if ($sweep.Detail) {
  $lines += "- **Sweep task:** not found or error ($($sweep.Detail))"
}
else {
  $sweepLabel = if ($sweep.Ok) { 'OK' } else { 'CHECK - last result was not 0' }
  $lines += "- **Sweep ($SweepTaskName):** $sweepLabel (last run $($sweep.LastRun), code $($sweep.Result), next $($sweep.NextRun))"
}
$lines += "- **Downloads inbox:** $dlTotal files ($dlRecent touched in last 24 h)"
$lines += "- **Screenshots inbox:** $ssTotal files ($ssRecent touched in last 24 h)"
$lines += ""
$lines += "## Your move (Cursor)"
$lines += ""
if ($latestManifest) {
  $lines += "1. Open this manifest in Cursor: ``$($latestManifest.FullName)``"
}
else {
  $lines += "1. No manifest found under ``01_OPS/LOGS`` - run ``Export-InboxTriageManifest.ps1`` manually."
}
$lines += "2. Enable rule **canonical-inbox-triage**, attach the manifest, review the batch, then say **apply** for moves you agree with."
$lines += "3. Naming-only passes: rule **canonical-naming** + ``01_OPS/NAMING_CONVENTIONS.md``."
$lines += "4. **Heavy / blurry / multi-step?** Enable **ai-council**, intake packet first, one Council brief before big edits (doctrine: OperatorOS ``canonical-support/AI_COUNCIL_DOCTRINE.md``)."
$lines += "5. **Meat-brain nudges:** keep ``01_OPS/REMINDERS/NUDGES_STANDING.md`` honest; optional pulse fills ``NUDGE_GLANCE.md`` — ``Register-CanonicalNudgePulseTask.ps1`` in template repo."
$lines += ""
$lines += "## AI Council + standing nudges (auto)"
$lines += ""
$lines += "_Council = structure + Verifier pass + one brief. Nudges = your lines echoed here every morning._"
$lines += ""
if (Test-Path -LiteralPath $nudgePath) {
  $rawN = Get-Content -LiteralPath $nudgePath -Encoding UTF8 -ErrorAction SilentlyContinue
  $nudgeLines = @($rawN | Where-Object { $_ -match '^\s*-\s' } | Select-Object -First 14)
  if ($nudgeLines.Count -gt 0) {
    $lines += $nudgeLines
  }
  else {
    $lines += "_Add ``-`` bullet lines to ``01_OPS/REMINDERS/NUDGES_STANDING.md`` — they show up here automatically._"
  }
}
else {
  $lines += "_NUDGES_STANDING.md missing (unexpected)._"
}
$lines += ""
$lines += "## Questions for you (only if relevant)"
$lines += ""
$q = 0
if (-not $sweep.Ok -and -not $sweep.Detail) {
  $q++
  $lines += "$q. Sweep last result was **$($sweep.Result)** - open Task Scheduler, confirm script path and last error, and fix if needed?"
}
elseif ($sweep.Detail) {
  $q++
  $lines += "$q. Sweep task missing or unreadable - is the task still named ``$SweepTaskName``?"
}
if ($dlTotal -ge $LargeInboxTotalWarn) {
  $q++
  $lines += "$q. Downloads inbox is **large ($dlTotal files)** - can you block ~15 minutes today for triage?"
}
if ($q -eq 0) {
  $lines += "_Nothing critical flagged. Triage is still optional but recommended._"
}
$lines += ""

Set-Content -LiteralPath $reminderFile -Value ($lines -join "`r`n") -Encoding UTF8

# Morning glance file (same script as midday pulse; no-op if nudges missing)
try {
  & (Join-Path $here 'Invoke-CanonicalNudgePulse.ps1') -CanonicalRoot $CanonicalRoot -ErrorAction Stop | Out-Null
}
catch {
  Write-Warning "Nudge glance refresh skipped: $($_.Exception.Message)"
}

Write-Host "Reminder: $reminderFile"
if ($OpenReminder) {
  if (Get-Command code -ErrorAction SilentlyContinue) {
    Start-Process 'code' -ArgumentList @('--reuse-window', $reminderFile)
  }
  else {
    notepad $reminderFile
  }
}
