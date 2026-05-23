#Requires -RunAsAdministrator
<#
.SYNOPSIS
  Installs OpenSSH Server (if needed), starts sshd, and allows inbound TCP 22 in Windows Firewall.

.NOTES
  Run elevated. In PowerShell 7+, Get-WindowsCapability is unavailable ("Class not registered");
  this script uses dism.exe for install instead. Windows PowerShell 5.1 can use either path.
#>
$ErrorActionPreference = 'Stop'

# Capability identity on current Windows 10/11 images (verify with: dism /Online /Get-Capabilities)
$capName = 'OpenSSH.Server~~~~0.0.1.0'
$dism = Join-Path $env:SystemRoot 'System32\dism.exe'

function Test-OpenSSHServerCapabilityInstalled {
  $info = & $dism /Online /Get-CapabilityInfo /CapabilityName:$capName 2>&1 | Out-String
  return ($info -match 'State\s*:\s*Installed')
}

function Install-OpenSSHServer {
  if ($PSVersionTable.PSEdition -eq 'Desktop') {
    Write-Host 'Using Get-WindowsCapability (Windows PowerShell 5.1)...'
    $cap = Get-WindowsCapability -Online | Where-Object { $_.Name -like 'OpenSSH.Server*' }
    if (-not $cap) {
      throw 'OpenSSH.Server capability not found on this Windows image.'
    }
    if ($cap.State -ne 'Installed') {
      Write-Host "Installing $($cap.Name) ..."
      Add-WindowsCapability -Online -Name $cap.Name | Out-Null
    }
    else {
      Write-Host 'OpenSSH Server already installed.'
    }
    return
  }

  Write-Host 'Using DISM (PowerShell 7+; avoids broken Get-WindowsCapability in pwsh)...'
  if (-not (Test-Path -LiteralPath $dism)) {
    throw "dism.exe not found at $dism"
  }
  if (Test-OpenSSHServerCapabilityInstalled) {
    Write-Host 'OpenSSH Server already installed.'
    return
  }
  Write-Host "Installing $capName ..."
  & $dism /Online /Add-Capability /CapabilityName:$capName /NoRestart
  if ($LASTEXITCODE -ne 0) {
    throw "DISM failed with exit $LASTEXITCODE. If the capability name changed, run: dism /Online /Get-Capabilities | findstr OpenSSH"
  }
}

Install-OpenSSHServer

Write-Host 'Configuring sshd service...'
if (-not (Get-Service -Name sshd -ErrorAction SilentlyContinue)) {
  throw 'sshd service not found after install. Reboot once and re-run, or check Optional Features for OpenSSH Server.'
}
Set-Service -Name sshd -StartupType Automatic
Start-Service sshd

$ruleName = 'OpenSSH-Server-In-TCP'

function Add-FirewallRulePort22 {
  $existing = Get-NetFirewallRule -Name $ruleName -ErrorAction SilentlyContinue
  if ($existing) {
    Enable-NetFirewallRule -Name $ruleName
    return
  }
  New-NetFirewallRule -Name $ruleName `
    -DisplayName 'OpenSSH SSH Server (sshd)' `
    -Enabled True -Direction Inbound -Protocol TCP -Action Allow -LocalPort 22 | Out-Null
}

try {
  Import-Module NetSecurity -ErrorAction Stop
  Write-Host 'Configuring Windows Firewall (NetSecurity)...'
  Add-FirewallRulePort22
}
catch {
  Write-Warning "NetSecurity module failed ($($_.Exception.Message)); using netsh."
  netsh advfirewall firewall delete rule name=$ruleName 2>$null | Out-Null
  $null = netsh advfirewall firewall add rule name=$ruleName dir=in action=allow protocol=TCP localport=22
}

Write-Host ''
Write-Host 'sshd status:'
Get-Service sshd | Format-List Name, Status, StartType
Write-Host 'Listening on 22 (if any):'
Get-NetTCPConnection -LocalPort 22 -State Listen -ErrorAction SilentlyContinue | Format-Table -AutoSize
Write-Host 'Done.'
