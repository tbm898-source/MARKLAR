# FieldPulse Lite — one-time install (Windows)
# Right-click -> Run with PowerShell, or double-click Install-FieldPulse.bat

$ErrorActionPreference = "Stop"
$Root = $PSScriptRoot

Write-Host ""
Write-Host "  FieldPulse Lite Installer" -ForegroundColor Green
Write-Host "  =========================" -ForegroundColor Green
Write-Host ""

# Node.js
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "  Node.js is not installed." -ForegroundColor Yellow
  Write-Host "  Install from https://nodejs.org (LTS), then run this installer again."
  Write-Host ""
  $open = Read-Host "Open nodejs.org in browser now? (y/n)"
  if ($open -eq "y") { Start-Process "https://nodejs.org" }
  exit 1
}

Write-Host "  Node: $(node -v)" -ForegroundColor Gray
Write-Host "  Installing dependencies (may take a few minutes)..." -ForegroundColor Cyan
Set-Location $Root
npm run install:all
if ($LASTEXITCODE -ne 0) { throw "npm install failed" }

if (-not (Test-Path "$Root\.env")) {
  Copy-Item "$Root\.env.example" "$Root\.env"
  Write-Host "  Created .env from .env.example (edit later for email)" -ForegroundColor Gray
}

Write-Host "  Initializing database..." -ForegroundColor Cyan
npm run db:init
if ($LASTEXITCODE -ne 0) { throw "db:init failed" }

Write-Host "  Building app for phone testing (single port)..." -ForegroundColor Cyan
npm run build
if ($LASTEXITCODE -ne 0) { throw "build failed" }

# Desktop shortcuts
$WshShell = New-Object -ComObject WScript.Shell
$Desktop = [Environment]::GetFolderPath("Desktop")
$Shortcut = $WshShell.CreateShortcut("$Desktop\FieldPulse Lite.lnk")
$Shortcut.TargetPath = "$Root\Start-FieldPulse.bat"
$Shortcut.WorkingDirectory = $Root
$Shortcut.Description = "Start FieldPulse Lite field logging in a browser"
$Shortcut.Save()

$DesktopShortcut = $WshShell.CreateShortcut("$Desktop\FieldPulse Lite Desktop.lnk")
$DesktopShortcut.TargetPath = "$Root\Start-FieldPulse-Desktop.bat"
$DesktopShortcut.WorkingDirectory = $Root
$DesktopShortcut.Description = "Start FieldPulse Lite as a local desktop app"
$DesktopShortcut.Save()

Write-Host ""
Write-Host "  Install complete!" -ForegroundColor Green
Write-Host ""
Write-Host "  Next: Double-click Desktop shortcut 'FieldPulse Lite Desktop'" -ForegroundColor White
Write-Host "        or run Start-FieldPulse-Desktop.bat in this folder." -ForegroundColor White
Write-Host "        Browser/server mode is still available as 'FieldPulse Lite'." -ForegroundColor White
Write-Host ""
Write-Host "  Your browser will open the setup page with a QR code for phones." -ForegroundColor White
Write-Host ""

$start = Read-Host "Start FieldPulse now? (y/n)"
if ($start -eq "y") {
  & "$Root\Start-FieldPulse-Desktop.bat"
}
