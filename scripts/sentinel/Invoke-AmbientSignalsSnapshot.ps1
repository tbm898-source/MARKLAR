#Requires -Version 5.1
<#
.SYNOPSIS
  Staleness + recent inbox filenames only (T0/T2) — fallback when daily reminders are skipped.

.NOTES
  Does not read file contents. Paths are relative to CANONICAL. JSON stdout + optional log append.
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [int]$RecentFileLimit = 18,
  [int]$StaleHoursDaily = 36,
  [int]$StaleHoursSentinel = 48,
  [switch]$NoLog
)

$ErrorActionPreference = 'Stop'

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}

function Get-FileAgeHours([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $dt = (Get-Item -LiteralPath $path).LastWriteTimeUtc
  [Math]::Round(((Get-Date).ToUniversalTime() - $dt).TotalHours, 1)
}

function Test-Stale([Nullable[double]]$hours, [double]$threshold) {
  if ($null -eq $hours) { return @{ stale = $false; missing = $true } }
  @{ stale = ($hours -ge $threshold); missing = $false }
}

$rem = Join-Path $CanonicalRoot '01_OPS\REMINDERS'
$logs = Join-Path $CanonicalRoot '01_OPS\LOGS'
$dl = Join-Path $CanonicalRoot '00_INBOX\Downloads'
$ss = Join-Path $CanonicalRoot '00_INBOX\Screenshots'

$dailyH = Get-FileAgeHours (Join-Path $rem 'LAST_DAILY_RUN.md')
$sentH = Get-FileAgeHours (Join-Path $rem 'SENTINEL_LAST.md')
$glanceH = Get-FileAgeHours (Join-Path $rem 'NUDGE_GLANCE.md')

$allInbox = @()
if (Test-Path -LiteralPath $dl) {
  $allInbox += Get-ChildItem -LiteralPath $dl -File -Force -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $ss) {
  $allInbox += Get-ChildItem -LiteralPath $ss -File -Force -ErrorAction SilentlyContinue
}
$recent = $allInbox |
  Sort-Object LastWriteTimeUtc -Descending |
  Select-Object -First $RecentFileLimit |
  ForEach-Object {
    $rel = $_.FullName.Substring($CanonicalRoot.Length).TrimStart('\')
    [pscustomobject]@{
      relativePath = $rel
      hoursOld     = [Math]::Round(((Get-Date).ToUniversalTime() - $_.LastWriteTimeUtc).TotalHours, 1)
      sizeBytes    = $_.Length
    }
  }

$latestManifest = $null
if (Test-Path -LiteralPath $logs) {
  $mf = Get-ChildItem -LiteralPath $logs -Filter 'triage_manifest_*.md' -File -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTimeUtc -Descending |
    Select-Object -First 1
  if ($mf) {
    $latestManifest = @{
      name      = $mf.Name
      hoursOld  = [Math]::Round(((Get-Date).ToUniversalTime() - $mf.LastWriteTimeUtc).TotalHours, 1)
    }
  }
}

$dailyStale = Test-Stale $dailyH $StaleHoursDaily
$sentStale = Test-Stale $sentH $StaleHoursSentinel

$obj = [ordered]@{
  generatedAtUtc    = (Get-Date).ToUniversalTime().ToString('o')
  trustNote         = 'T0/T2 only: mtimes, counts, relative paths — no file contents'
  stalenessHours    = @{
    lastDailyRun = $dailyH
    sentinelLast = $sentH
    nudgeGlance  = $glanceH
  }
  staleFlags        = @{
    dailyRunOver    = $dailyStale.stale
    sentinelOver    = $sentStale.stale
    dailyMissing    = $dailyStale.missing
    sentinelMissing = $sentStale.missing
  }
  cadenceDebt       = @{
    dailyNeedsAttention    = ($dailyStale.missing -or $dailyStale.stale)
    sentinelNeedsAttention = ($sentStale.missing -or $sentStale.stale)
  }
  inboxRecentNames  = @($recent)
  latestManifest    = $latestManifest
  thresholds        = @{ staleHoursDaily = $StaleHoursDaily; staleHoursSentinel = $StaleHoursSentinel }
}

$json = $obj | ConvertTo-Json -Depth 6 -Compress
Write-Output $json

if (-not $NoLog) {
  $logDir = $logs
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $logFile = Join-Path $logDir ("ambient_signals_{0:yyyy-MM-dd}.log" -f (Get-Date))
  Add-Content -LiteralPath $logFile -Value $json -Encoding UTF8
  Write-Host "Log: $logFile" -ForegroundColor DarkGray
}
