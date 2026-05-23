#Requires -Version 5.1
<#
.SYNOPSIS
  One-shot visibility: git + CANONICAL + inbox counts + scheduled tasks + host snapshot → JSON, log line, and pin-friendly Markdown.

.PARAMETER GitRepoRoot
  Repo with .git (default: parent of /scripts).

.PARAMETER CanonicalRoot
  CANONICAL tree (default: CANONICAL_ROOT env, else Dropbox\CANONICAL). Optional — git/host still run if missing.

.PARAMETER NoLog
  Skip append to CANONICAL logs and skip writing SENTINEL_LAST.md.

.PARAMETER OpenResult
  Open SENTINEL_LAST.md in VS Code or Notepad after write.

.EXAMPLE
  .\Invoke-SentinelVisibilitySnapshot.ps1
.EXAMPLE
  .\Invoke-SentinelVisibilitySnapshot.ps1 -OpenResult
#>
param(
  [string]$GitRepoRoot = $(Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path,
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [string]$SweepTaskName = 'CANONICAL Inbox Sweep',
  [string]$DailyTaskName = 'CANONICAL Daily Routine',
  [switch]$NoLog,
  [switch]$OpenResult
)

$ErrorActionPreference = 'Stop'
$scriptsRoot = Split-Path $PSScriptRoot
$operatorSnap = Join-Path $scriptsRoot 'operator\Invoke-OperatorHostSnapshot.ps1'

function Get-TaskBrief([string]$Name) {
  try {
    $task = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -eq $Name } | Select-Object -First 1
    if (-not $task) {
      return @{ Name = $Name; Found = $false }
    }
    $info = Get-ScheduledTaskInfo -InputObject $task
    @{
      Name           = $Name
      Found          = $true
      State          = $task.State.ToString()
      LastRunTime    = $info.LastRunTime
      LastTaskResult = $info.LastTaskResult
      NextRunTime    = $info.NextRunTime
    }
  }
  catch {
    @{ Name = $Name; Found = $false; Error = $_.Exception.Message }
  }
}

function Get-GitSnapshot([string]$root) {
  $gitDir = Join-Path $root '.git'
  if (-not (Test-Path -LiteralPath $gitDir)) {
    return @{ present = $false; detail = 'no .git at GitRepoRoot' }
  }
  Push-Location $root
  try {
    $branch = (& git rev-parse --abbrev-ref HEAD 2>$null | Select-Object -First 1).ToString().Trim()
    $remote = (& git remote get-url origin 2>$null | Select-Object -First 1).ToString().Trim()
    if (-not $remote) { $remote = '(no origin)' }
    $sb = (& git status -sb 2>$null | ForEach-Object { $_.ToString() }) -join "`n"
    return @{
      present = $true
      branch  = $branch
      origin  = $remote
      status  = $sb
    }
  }
  finally {
    Pop-Location
  }
}

function Get-InboxCount([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  (Get-ChildItem -LiteralPath $path -File -Force | Measure-Object).Count
}

function Invoke-OperatorSnapshotJson {
  if (-not (Test-Path -LiteralPath $operatorSnap)) {
    return $null
  }
  $out = & powershell.exe -NoProfile -ExecutionPolicy Bypass -File $operatorSnap -NoLog 2>&1
  $line = $out | Where-Object { $_.ToString().TrimStart().StartsWith('{') } | Select-Object -First 1
  if (-not $line) { return $null }
  try {
    return ($line.ToString() | ConvertFrom-Json)
  }
  catch {
    return @{ parseError = $true; raw = $line.ToString().Substring(0, [Math]::Min(200, $line.ToString().Length)) }
  }
}

$git = Get-GitSnapshot $GitRepoRoot
$canonicalOk = [bool]($CanonicalRoot -and (Test-Path -LiteralPath $CanonicalRoot))
$inboxDl = if ($canonicalOk) { Join-Path $CanonicalRoot '00_INBOX\Downloads' } else { '' }
$inboxSs = if ($canonicalOk) { Join-Path $CanonicalRoot '00_INBOX\Screenshots' } else { '' }
$reminderDir = if ($canonicalOk) { Join-Path $CanonicalRoot '01_OPS\REMINDERS' } else { '' }
$lastDaily = if ($canonicalOk) { Join-Path $reminderDir 'LAST_DAILY_RUN.md' } else { '' }
$glance = if ($canonicalOk) { Join-Path $reminderDir 'NUDGE_GLANCE.md' } else { '' }

$lastDailyM = $null
if ($lastDaily -and (Test-Path -LiteralPath $lastDaily)) {
  $lastDailyM = (Get-Item -LiteralPath $lastDaily).LastWriteTimeUtc.ToString('o')
}
$glanceM = $null
if ($glance -and (Test-Path -LiteralPath $glance)) {
  $glanceM = (Get-Item -LiteralPath $glance).LastWriteTimeUtc.ToString('o')
}

$canonicalBlock = @{
  root              = $CanonicalRoot
  resolved          = $canonicalOk
  downloadsCount    = if ($canonicalOk) { Get-InboxCount $inboxDl } else { $null }
  screenshotsCount  = if ($canonicalOk) { Get-InboxCount $inboxSs } else { $null }
  lastDailyRunUtc   = $lastDailyM
  nudgeGlanceUtc    = $glanceM
}

$obj = [ordered]@{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  gitRepoRoot    = $GitRepoRoot
  git            = $git
  canonical      = $canonicalBlock
  tasks          = @{
    sweep = Get-TaskBrief $SweepTaskName
    daily = Get-TaskBrief $DailyTaskName
  }
  host           = (Invoke-OperatorSnapshotJson)
}

$json = $obj | ConvertTo-Json -Depth 8 -Compress
Write-Output $json

# Markdown for humans
$md = @()
$md += '# Sentinel visibility'
$md += ''
$md += "**Generated (UTC):** $((Get-Date).ToUniversalTime().ToString('o'))"
$md += ''
$md += '## Git'
$md += ''
if (-not $git.present) {
  $md += '_No git repo at GitRepoRoot._'
}
else {
  $md += "- **Branch:** ``$($git.branch)``"
  $md += "- **origin:** ``$($git.origin)``"
  $md += '```'
  $md += $git.status
  $md += '```'
}
$md += ''
$md += '## CANONICAL'
$md += ''
if (-not $canonicalOk) {
  $md += '_CANONICAL root not resolved (set CANONICAL_ROOT or create Dropbox\CANONICAL)._'
}
else {
  $md += "- **Root:** ``$CanonicalRoot``"
  $md += "- **00_INBOX/Downloads files:** $($canonicalBlock.downloadsCount)"
  $md += "- **00_INBOX/Screenshots files:** $($canonicalBlock.screenshotsCount)"
  $md += "- **LAST_DAILY_RUN.md last write (UTC):** $(if ($lastDailyM) { $lastDailyM } else { '_missing_' })"
  $md += "- **NUDGE_GLANCE.md last write (UTC):** $(if ($glanceM) { $glanceM } else { '_missing_' })"
}
$md += ''
$md += '## Scheduled tasks'
$md += ''
foreach ($t in @($obj.tasks['sweep'], $obj.tasks['daily'])) {
  if (-not $t -or -not $t.Found) {
    $md += "- **$($t.Name):** not found"
  }
  else {
    $ok = ($t.LastTaskResult -eq 0)
    $flag = if ($ok) { 'OK' } else { 'CHECK' }
    $md += "- **$($t.Name):** $flag · last $($t.LastRunTime) · code $($t.LastTaskResult) · next $($t.NextRunTime)"
  }
}
$md += ''
$md += '## Host snapshot (Tier A)'
$md += ''
if (-not $obj.host) {
  $md += '_Host snapshot script missing or failed._'
}
else {
  $h = $obj.host
  $md += "- **OS:** $($h.os.caption) · uptime **$($h.os.uptimeHours)** h"
  foreach ($L in @($h.linksUp)) {
    $md += "- **Link:** $($L.Name) · $($L.LinkSpeed) · $($L.Description)"
  }
  $md += "- **Tailscale CLI:** present=$($h.tailscale.present) · statusOk=$($h.tailscale.statusOk)"
}
$md += ''
$md += '## Commands to refresh'
$md += ''
$md += '```text'
$md += 'powershell -NoProfile -ExecutionPolicy Bypass -File scripts/sentinel/Invoke-SentinelVisibilitySnapshot.ps1'
$md += '```'
$md += ''
$mdText = $md -join "`n"

if (-not $NoLog -and $canonicalOk) {
  $logDir = Join-Path $CanonicalRoot '01_OPS\LOGS'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $logFile = Join-Path $logDir ("sentinel_visibility_{0:yyyy-MM-dd}.log" -f (Get-Date))
  Add-Content -LiteralPath $logFile -Value $json -Encoding UTF8
  Write-Host "Log: $logFile" -ForegroundColor DarkGray

  $reminderDir2 = Join-Path $CanonicalRoot '01_OPS\REMINDERS'
  New-Item -ItemType Directory -Force -Path $reminderDir2 | Out-Null
  $mdPath = Join-Path $reminderDir2 'SENTINEL_LAST.md'
  Set-Content -LiteralPath $mdPath -Value $mdText -Encoding UTF8
  Write-Host "Pinned: $mdPath" -ForegroundColor DarkGray

  if ($OpenResult) {
    if (Get-Command code -ErrorAction SilentlyContinue) {
      Start-Process 'code' -ArgumentList @('--reuse-window', $mdPath)
    }
    else {
      Start-Process notepad.exe -ArgumentList $mdPath
    }
  }
}
elseif (-not $NoLog) {
  Write-Warning 'CANONICAL not available: JSON printed to stdout only. Set CANONICAL_ROOT for SENTINEL_LAST.md + log append.'
}
