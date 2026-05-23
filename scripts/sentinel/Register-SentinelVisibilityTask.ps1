#Requires -Version 5.1
<#
.SYNOPSIS
  Registers a daily task to refresh SENTINEL_LAST.md + append JSON log (default 08:15).

.PARAMETER GitRepoRoot
  Path to repo with .git (default: two levels above this script = OperatorOS template root).
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [string]$GitRepoRoot = $(try { (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path } catch { '' }),
  [string]$DailyAt = '08:15',
  [string]$TaskName = 'CANONICAL Sentinel Visibility'
)

$ErrorActionPreference = 'Stop'

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}
$sentinel = Join-Path $PSScriptRoot 'Invoke-SentinelVisibilitySnapshot.ps1'
if (-not (Test-Path -LiteralPath $sentinel)) {
  Write-Error "Missing: $sentinel"
}
if (-not $GitRepoRoot -or -not (Test-Path (Join-Path $GitRepoRoot '.git'))) {
  Write-Error "GitRepoRoot must point at a clone with .git (pass -GitRepoRoot)."
}

$parts = $DailyAt -split ':'
$hour = [int]$parts[0]
$minute = [int]$parts[1]
$start = Get-Date -Hour $hour -Minute $minute -Second 0

$arg = "-NoProfile -ExecutionPolicy Bypass -File `"$sentinel`" -GitRepoRoot `"$GitRepoRoot`" -CanonicalRoot `"$CanonicalRoot`""
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arg -WorkingDirectory $GitRepoRoot
$trigger = New-ScheduledTaskTrigger -Daily -At $start
$principal = New-ScheduledTaskPrincipal -UserId $env:USERNAME -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue |
  Unregister-ScheduledTask -Confirm:$false -ErrorAction SilentlyContinue

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings `
  -Description 'CANONICAL: refresh 01_OPS/REMINDERS/SENTINEL_LAST.md + sentinel JSON log'

Write-Host "Registered: $TaskName at $DailyAt"
Write-Host "Script: $sentinel"
