#Requires -Version 5.1
<#
.SYNOPSIS
  Host/network snapshot for the Operator subagent: Tier A by default (no MAC, no WAN IPv4).

.PARAMETER CanonicalRoot
  If set and path exists, appends one JSON line per run to 01_OPS/LOGS/operator_host_YYYY-MM-DD.log
  unless -NoLog. Resolution: parameter > CANONICAL_ROOT env > %USERPROFILE%\Dropbox\CANONICAL.

.PARAMETER Extended
  Tier B: IPv4 per interface (RFC1918/loopback only; other addresses shown as "WAN_REDACTED"),
  longer Tailscale status preview.

.PARAMETER NoLog
  Never write to disk (stdout only).

.EXAMPLE
  .\Invoke-OperatorHostSnapshot.ps1
.EXAMPLE
  .\Invoke-OperatorHostSnapshot.ps1 -Extended
#>
param(
  [string]$CanonicalRoot = $(
    if ($env:CANONICAL_ROOT) { $env:CANONICAL_ROOT }
    elseif (Test-Path (Join-Path $env:USERPROFILE 'Dropbox\CANONICAL')) {
      Join-Path $env:USERPROFILE 'Dropbox\CANONICAL'
    }
    else { '' }
  ),
  [switch]$Extended,
  [switch]$NoLog
)

$ErrorActionPreference = 'Stop'

function Test-PrivateOrLoopbackIPv4([string]$ip) {
  if ($ip -eq '127.0.0.1') { return $true }
  if ($ip -match '^10\.') { return $true }
  if ($ip -match '^192\.168\.') { return $true }
  if ($ip -match '^172\.(1[6-9]|2\d|3[0-1])\.') { return $true }
  if ($ip -match '^100\.(6[4-9]|[7-9]\d|1[0-1]\d|12[0-7])\.') { return $true } # CGNAT, often carrier
  return $false
}

function Get-OsSummary {
  $os = Get-CimInstance -ClassName Win32_OperatingSystem
  $boot = $os.LastBootUpTime
  $uptime = (Get-Date) - $boot
  @{
    caption        = $os.Caption
    version        = $os.Version
    uptimeHours    = [Math]::Round($uptime.TotalHours, 2)
    lastBootUtc    = $boot.ToUniversalTime().ToString('o')
  }
}

function Get-LinkSummaries {
  $adapters = Get-NetAdapter -ErrorAction SilentlyContinue |
    Where-Object { $_.Status -eq 'Up' -and $_.HardwareInterface -eq $true }
  $out = foreach ($a in $adapters) {
    [pscustomobject]@{
      Name             = $a.Name
      Description      = $a.InterfaceDescription
      LinkSpeed        = $a.LinkSpeed
      MediaType        = $a.MediaType
      # MAC intentionally omitted
    }
  }
  @($out)
}

function Get-IPv4TierB {
  $rows = Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
    Where-Object { $_.IPAddress -ne '127.0.0.1' }
  foreach ($r in $rows) {
    $ip = $r.IPAddress
    $shown = if (Test-PrivateOrLoopbackIPv4 $ip) { $ip } else { 'WAN_REDACTED' }
    [pscustomobject]@{
      InterfaceAlias = $r.InterfaceAlias
      Address        = $shown
      PrefixLength   = $r.PrefixLength
    }
  }
}

function Get-TailscaleBlock {
  $cmd = Get-Command tailscale.exe -ErrorAction SilentlyContinue
  if (-not $cmd) {
    return @{ present = $false; statusOk = $false; preview = $null }
  }
  $ok = $false
  try {
    & tailscale.exe status 2>$null | Out-Null
    $ok = ($LASTEXITCODE -eq 0)
  }
  catch { $ok = $false }

  $preview = $null
  if ($Extended) {
    try {
      $lines = @(tailscale.exe status 2>&1 | ForEach-Object { $_.ToString() })
      $preview = ($lines | Select-Object -First 18) -join "`n"
    }
    catch { $preview = $null }
  }

  @{
    present   = $true
    statusOk  = $ok
    preview   = $preview
  }
}

$redactions = @(
  'MAC addresses never collected',
  'Non-RFC1918/non-Tailscale-CGNAT IPv4 shown as WAN_REDACTED in Extended tier only'
)

$obj = [ordered]@{
  generatedAtUtc = (Get-Date).ToUniversalTime().ToString('o')
  tier           = if ($Extended) { 'A+B' } else { 'A' }
  redactionsApplied = $redactions
  os             = Get-OsSummary
  linksUp        = @(Get-LinkSummaries)
  tailscale      = Get-TailscaleBlock
}

if ($Extended) {
  $obj['ipv4Interfaces'] = @(Get-IPv4TierB)
}

$json = $obj | ConvertTo-Json -Depth 6 -Compress
Write-Output $json

if (-not $NoLog -and $CanonicalRoot -and (Test-Path -LiteralPath $CanonicalRoot)) {
  $logDir = Join-Path $CanonicalRoot '01_OPS\LOGS'
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  $logFile = Join-Path $logDir ("operator_host_{0:yyyy-MM-dd}.log" -f (Get-Date))
  Add-Content -LiteralPath $logFile -Value $json -Encoding UTF8
  Write-Host "Logged: $logFile" -ForegroundColor DarkGray
}
