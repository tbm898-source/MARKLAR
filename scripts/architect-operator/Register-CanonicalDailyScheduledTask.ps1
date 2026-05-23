#Requires -Version 5.1
<#
.SYNOPSIS
  Registers (or replaces) a morning scheduled task: report + triage manifest + LAST_DAILY_RUN.md

.NOTES
  Usually works without elevation for your own user. If registration fails, re-run PowerShell as Administrator.
  Adjust -DailyAt if you want a different time than 07:00.
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [string]$DailyAt = '07:00',
  [string]$TaskName = 'CANONICAL Daily Routine',
  [string]$RoutineScriptPath = ''
)

$ErrorActionPreference = 'Stop'

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}

if (-not $RoutineScriptPath) {
  $RoutineScriptPath = Join-Path $CanonicalRoot '01_OPS\architect-operator\Invoke-DailyCanonicalRoutine.ps1'
  if (-not (Test-Path -LiteralPath $RoutineScriptPath)) {
    $RoutineScriptPath = Join-Path $PSScriptRoot 'Invoke-DailyCanonicalRoutine.ps1'
  }
}
if (-not (Test-Path -LiteralPath $RoutineScriptPath)) {
  Write-Error "Missing Invoke-DailyCanonicalRoutine.ps1. Pass -RoutineScriptPath or copy scripts to CANONICAL\01_OPS\architect-operator\"
}
$routine = $RoutineScriptPath

$parts = $DailyAt -split ':'
if ($parts.Count -ne 2) { Write-Error "DailyAt must be like 07:00 or 6:30" }
$hour = [int]$parts[0]
$minute = [int]$parts[1]
$start = Get-Date -Hour $hour -Minute $minute -Second 0

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$routine`" -CanonicalRoot `"$CanonicalRoot`""

$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $CanonicalRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $start
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue |
  Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
    -Description 'CANONICAL: daily report, triage manifest, LAST_DAILY_RUN.md, council+nudge hooks'
}
catch {
  Write-Error "Registration failed: $($_.Exception.Message). Try: Run PowerShell as Administrator, then run this script again."
}

Write-Host "Registered task: $TaskName (daily at $DailyAt)"
Write-Host "Routine script: $routine"
