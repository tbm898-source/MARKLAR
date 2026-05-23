#Requires -Version 5.1
<#
.SYNOPSIS
  Writes 01_OPS/REMINDERS/NUDGE_GLANCE.md with one rotating line from NUDGES_STANDING.md.

.NOTES
  Schedule 3–4x daily via Register-CanonicalNudgePulseTask.ps1. Low noise: one file to glance at.
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [switch]$OpenGlance
)

$ErrorActionPreference = 'Stop'

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}

$reminderDir = Join-Path $CanonicalRoot '01_OPS\REMINDERS'
New-Item -ItemType Directory -Force -Path $reminderDir | Out-Null
$nudgeFile = Join-Path $reminderDir 'NUDGES_STANDING.md'
$glanceFile = Join-Path $reminderDir 'NUDGE_GLANCE.md'

if (-not (Test-Path -LiteralPath $nudgeFile)) {
  $msg = @"
# Glance nudge
**When:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')  
**Now:** Create ``01_OPS/REMINDERS/NUDGES_STANDING.md`` (daily routine seeds it from the template on first run).
"@
  Set-Content -LiteralPath $glanceFile -Value $msg -Encoding UTF8
  if ($OpenGlance) { Start-Process notepad.exe -ArgumentList $glanceFile }
  return
}

$lines = Get-Content -LiteralPath $nudgeFile -Encoding UTF8 -ErrorAction SilentlyContinue
$bullets = @()
foreach ($line in $lines) {
  if ($line -match '^\s*-\s+(.+)$') {
    $bullets += $Matches[1].Trim()
  }
}

if ($bullets.Count -eq 0) {
  $pick = '_Add dash bullets (- item) to NUDGES_STANDING.md_'
}
else {
  $ix = [Math]::Abs((Get-Date).DayOfYear + (Get-Date).Hour) % $bullets.Count
  $pick = $bullets[$ix]
}

$body = @"
# Glance nudge
**When:** $(Get-Date -Format 'yyyy-MM-dd HH:mm')  
**Now:** $pick

_Full list: ``01_OPS/REMINDERS/NUDGES_STANDING.md`` · Council: ``ai-council`` rule + ``canonical-support/AI_COUNCIL_DOCTRINE.md`` in OperatorOS repo_
"@
Set-Content -LiteralPath $glanceFile -Value $body -Encoding UTF8
Write-Host "Updated: $glanceFile"

if ($OpenGlance) {
  if (Get-Command code -ErrorAction SilentlyContinue) {
    Start-Process 'code' -ArgumentList @('--reuse-window', $glanceFile)
  }
  else {
    Start-Process notepad.exe -ArgumentList $glanceFile
  }
}
