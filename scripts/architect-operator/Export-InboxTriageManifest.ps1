#Requires -Version 5.1
<#
.SYNOPSIS
  Writes a markdown manifest of the newest inbox files for Cursor triage agents.

.OUTPUTS
  CANONICAL/01_OPS/LOGS/triage_manifest_YYYY-MM-dd_HHmmss.md
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [int]$Count = 25,
  [switch]$IncludeScreenshots
)

$ErrorActionPreference = 'Stop'
if (-not $CanonicalRoot -or -not (Test-Path -LiteralPath $CanonicalRoot)) {
  Write-Error "CANONICAL root not found. Set CANONICAL_ROOT or pass -CanonicalRoot."
}

$dl = Join-Path $CanonicalRoot '00_INBOX\Downloads'
$ss = Join-Path $CanonicalRoot '00_INBOX\Screenshots'
$logDir = Join-Path $CanonicalRoot '01_OPS\LOGS'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$out = Join-Path $logDir "triage_manifest_$stamp.md"

function Get-InboxSlice([string]$dir, [string]$label, [int]$take) {
  if (-not (Test-Path -LiteralPath $dir)) {
    return @()
  }
  Get-ChildItem -LiteralPath $dir -File -Force |
    Sort-Object LastWriteTime -Descending |
    Select-Object -First $take |
    ForEach-Object {
      [pscustomobject]@{
        Bucket = $label
        Name   = $_.Name
        Full   = $_.FullName
        Ext    = $_.Extension
        Bytes  = $_.Length
        Modified = $_.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
      }
    }
}

$rows = @()
$rows += Get-InboxSlice -dir $dl -label 'Downloads' -take $Count
if ($IncludeScreenshots) {
  $rows += Get-InboxSlice -dir $ss -label 'Screenshots' -take $Count
}

$sb = New-Object System.Text.StringBuilder
[void]$sb.AppendLine("# Inbox triage manifest")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("- Generated: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')")
[void]$sb.AppendLine("- CANONICAL: ``$CanonicalRoot``")
[void]$sb.AppendLine("- Read ``canonical-support/NAMING_CONVENTIONS.md`` and ``CANONICAL_MAP.md`` (template repo) or ``01_OPS/NAMING_CONVENTIONS.md`` and ``01_OPS/CANONICAL_MAP.md`` on disk.")
[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Files (newest first)")
[void]$sb.AppendLine("")
[void]$sb.AppendLine('| Bucket | Modified | Size (KB) | File |')
[void]$sb.AppendLine('|--------|----------|-----------|------|')

foreach ($r in $rows) {
  $kb = [math]::Round($r.Bytes / 1024, 1)
  $name = $r.Name -replace '\|', '/'  # avoid breaking markdown tables
  [void]$sb.AppendLine("| $($r.Bucket) | $($r.Modified) | $kb | ``$name`` |")
}

[void]$sb.AppendLine("")
[void]$sb.AppendLine("## Full paths (for move commands)")
[void]$sb.AppendLine("")
foreach ($r in $rows) {
  [void]$sb.AppendLine("- ``$($r.Full)``")
}

Set-Content -LiteralPath $out -Value $sb.ToString() -Encoding UTF8
Write-Host "Wrote: $out"
Write-Host "Rows:  $($rows.Count)"
