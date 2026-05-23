#Requires -Version 5.1
<#
.SYNOPSIS
  Architect-operator daily automation: inbox stats, sweep task health, optional Tailscale PDF.

.PARAMETER CanonicalRoot
  Root of CANONICAL tree. Falls back to CANONICAL_ROOT env, then %USERPROFILE%\Dropbox\CANONICAL.

.EXAMPLE
  .\Invoke-ArchitectOperatorReport.ps1
.EXAMPLE
  .\Invoke-ArchitectOperatorReport.ps1 -RefreshTailscalePdf -OpenInbox
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
  [switch]$RefreshTailscalePdf,
  [switch]$OpenInbox,
  [switch]$Weekly,
  [int]$RecentHours = 24
)

$ErrorActionPreference = 'Stop'

function Get-EdgeExecutable {
  foreach ($p in @(
      "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
      "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe"
    )) {
    if (Test-Path $p) { return $p }
  }
  return $null
}

function Convert-MarkdownToPrintHtml {
  param([string]$MarkdownPath)
  $raw = Get-Content -LiteralPath $MarkdownPath -Raw -Encoding UTF8
  $safe = $raw -replace '&', '&amp;' -replace '<', '&lt;' -replace '>', '&gt;'
  @"
<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>Tailscale checklist</title>
<style>
body{font-family:'Segoe UI',system-ui,sans-serif;margin:0.5in;max-width:7.5in}
pre{white-space:pre-wrap;font-size:11pt;line-height:1.4;margin:0}
</style></head><body><pre>$safe</pre></body></html>
"@
}

function New-TailscaleChecklistPdf {
  param([string]$Root)
  $md = Join-Path $Root '01_OPS\Tailscale_Home_Setup_Checklist.md'
  $pdfDir = Join-Path $Root '01_OPS\PRINTS'
  $pdf = Join-Path $pdfDir 'Tailscale_Home_Setup_Checklist.pdf'
  if (-not (Test-Path -LiteralPath $md)) {
    Write-Warning "Missing checklist: $md"
    return $false
  }
  New-Item -ItemType Directory -Force -Path $pdfDir | Out-Null
  $edge = Get-EdgeExecutable
  if (-not $edge) {
    Write-Warning 'Microsoft Edge not found; cannot build PDF.'
    return $false
  }
  $html = Join-Path $env:TEMP "tailscale_checklist_$(Get-Random).html"
  $htmlContent = Convert-MarkdownToPrintHtml -MarkdownPath $md
  Set-Content -LiteralPath $html -Value $htmlContent -Encoding UTF8
  $uri = ([System.Uri]$html).AbsoluteUri
  Remove-Item -LiteralPath $pdf -Force -ErrorAction SilentlyContinue
  & $edge --headless=new --disable-gpu --no-pdf-header-footer --print-to-pdf="$pdf" $uri 2>$null
  Start-Sleep -Seconds 2
  Remove-Item -LiteralPath $html -Force -ErrorAction SilentlyContinue
  if (Test-Path -LiteralPath $pdf) {
    Write-Host "PDF updated: $pdf"
    return $true
  }
  Write-Warning 'PDF generation failed.'
  return $false
}

function Get-SweepTaskReport {
  param([string]$Name)
  try {
    $task = Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { $_.TaskName -eq $Name } | Select-Object -First 1
    if (-not $task) { throw "Task not found" }
    $info = Get-ScheduledTaskInfo -InputObject $task
    [pscustomobject]@{
      Found          = $true
      State          = $task.State.ToString()
      LastRunTime    = $info.LastRunTime
      LastTaskResult = $info.LastTaskResult
      NextRunTime    = $info.NextRunTime
    }
  }
  catch {
    [pscustomobject]@{
      Found          = $false
      State          = ''
      LastRunTime    = $null
      LastTaskResult = $null
      NextRunTime    = $null
      Error          = $_.Exception.Message
    }
  }
}

if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot. Tried: $CanonicalRoot"
}

$inboxDl = Join-Path $CanonicalRoot '00_INBOX\Downloads'
$inboxSs = Join-Path $CanonicalRoot '00_INBOX\Screenshots'
$logDir = Join-Path $CanonicalRoot '01_OPS\LOGS'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$logFile = Join-Path $logDir ("architect_operator_{0:yyyy-MM-dd}.log" -f (Get-Date))

$since = (Get-Date).AddHours(-1 * [Math]::Max(1, $RecentHours))

function Get-InboxMetrics([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    return @{ Total = 0; Recent = 0 }
  }
  $files = Get-ChildItem -LiteralPath $path -File -Force
  $total = $files.Count
  $recent = ($files | Where-Object { $_.LastWriteTime -ge $since }).Count
  return @{ Total = $total; Recent = $recent }
}

$dl = Get-InboxMetrics $inboxDl
$ss = Get-InboxMetrics $inboxSs
$sweep = Get-SweepTaskReport -Name $SweepTaskName

$lines = @()
$lines += "=== Architect-Operator Report $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==="
$lines += "CANONICAL: $CanonicalRoot"
$lines += ""
$lines += "[Inbox] Downloads: $($dl.Total) files ($($dl.Recent) touched in last $RecentHours h)"
$lines += "[Inbox] Screenshots: $($ss.Total) files ($($ss.Recent) touched in last $RecentHours h)"
$bothEmpty = ($dl.Total -eq 0) -and ($ss.Total -eq 0)
if ($bothEmpty) {
  $lines += "[Note] Both inbox folders are empty - confirm sweep task ran (see below)."
}
$lines += ""
if ($sweep.Found) {
  $ok = ($sweep.LastTaskResult -eq 0)
  $lines += "[Sweep Task] $SweepTaskName"
  $lines += "  State: $($sweep.State)"
  $lines += "  LastRunTime: $($sweep.LastRunTime)"
  $lines += "  LastTaskResult: $($sweep.LastTaskResult) $(if ($ok) { '(OK)' } else { '(CHECK)' })"
  $lines += "  NextRunTime: $($sweep.NextRunTime)"
}
else {
  $lines += "[Sweep Task] NOT FOUND: $SweepTaskName"
  if ($sweep.Error) { $lines += "  $($sweep.Error)" }
}
$lines += ""
$lines += "Paths:"
$lines += "  MASTER_TASKS: $(Join-Path $CanonicalRoot '01_OPS\MASTER_TASKS.md')"
$lines += "  Doctrine:     $(Join-Path $CanonicalRoot '01_OPS\Architect-Operator-and-Tasks-for-Cursor.md')"
$lines += ""

if ($Weekly) {
  $lines += "=== Weekly reset (manual) ==="
  $lines += "1. Pick exactly three outcomes for the week."
  $lines += "2. Promote supporting tasks to P1/P2 in 01_OPS/MASTER_TASKS.md"
  $lines += "3. Empty and triage 00_INBOX."
  $lines += "4. Archive completed projects and clutter."
  $lines += ""
}

$text = $lines -join "`r`n"
Write-Host $text
Add-Content -LiteralPath $logFile -Value $text -Encoding UTF8
Write-Host ""
Write-Host "Log: $logFile"

if ($RefreshTailscalePdf) {
  New-TailscaleChecklistPdf -Root $CanonicalRoot | Out-Null
}

if ($OpenInbox) {
  if (Test-Path -LiteralPath $inboxDl) { Start-Process explorer.exe $inboxDl }
}
