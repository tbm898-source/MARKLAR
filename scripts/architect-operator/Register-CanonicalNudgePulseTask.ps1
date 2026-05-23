#Requires -Version 5.1
<#
.SYNOPSIS
  Registers a scheduled task that refreshes NUDGE_GLANCE.md several times per day.

.PARAMETER Times
  Local clock times like 10:00,13:00,16:00 (comma-separated). Default: mid-morning, lunch, afternoon.

.EXAMPLE
  .\Register-CanonicalNudgePulseTask.ps1
.EXAMPLE
  .\Register-CanonicalNudgePulseTask.ps1 -Times '09:30,12:30,15:30,18:00'
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [string]$Times = '10:00,13:00,16:00,19:00',
  [string]$TaskName = 'CANONICAL Nudge Pulse',
  [string]$ScriptPath = $(Join-Path $PSScriptRoot 'Invoke-CanonicalNudgePulse.ps1')
)

$ErrorActionPreference = 'Stop'

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}
if (-not (Test-Path -LiteralPath $ScriptPath)) {
  Write-Error "Missing pulse script: $ScriptPath"
}

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$ScriptPath`" -CanonicalRoot `"$CanonicalRoot`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $CanonicalRoot

$triggers = @()
foreach ($token in ($Times -split ',' | ForEach-Object { $_.Trim() } | Where-Object { $_ })) {
  $p = $token -split ':'
  if ($p.Count -ne 2) { throw "Bad time token (use HH:mm): $token" }
  $h = [int]$p[0]
  $m = [int]$p[1]
  $at = Get-Date -Hour $h -Minute $m -Second 0
  $triggers += New-ScheduledTaskTrigger -Daily -At $at
}

$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue |
  Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue

try {
  Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $triggers -Principal $principal -Settings $settings `
    -Description 'CANONICAL: rotate one line into 01_OPS/REMINDERS/NUDGE_GLANCE.md from NUDGES_STANDING.md'
}
catch {
  Write-Error "Registration failed: $($_.Exception.Message). Try PowerShell as Administrator."
}

Write-Host "Registered task: $TaskName at $Times"
Write-Host "Script: $ScriptPath"
