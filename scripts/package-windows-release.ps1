$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ElectronPackagePath = Join-Path $Root "electron\package.json"
$ElectronPackage = Get-Content $ElectronPackagePath -Raw | ConvertFrom-Json
$Version = $ElectronPackage.version
$InstallerName = "FieldPulse-Lite-Setup-$Version.exe"
$InstallerPath = Join-Path $Root "electron\dist\$InstallerName"

if (!(Test-Path $InstallerPath)) {
  throw "Installer not found at $InstallerPath. Run 'npm run desktop:dist' first."
}

$ReleaseRoot = Join-Path $Root "release"
$ReleaseDir = Join-Path $ReleaseRoot "FieldPulse-Lite-Windows"
$ResolvedRoot = (Resolve-Path $Root).Path

if (Test-Path $ReleaseDir) {
  $ResolvedReleaseDir = (Resolve-Path $ReleaseDir).Path
  $ExpectedPrefix = Join-Path $ResolvedRoot "release"
  if (!$ResolvedReleaseDir.StartsWith($ExpectedPrefix, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to remove unexpected release path: $ResolvedReleaseDir"
  }
  Remove-Item -LiteralPath $ReleaseDir -Recurse -Force
}

New-Item -ItemType Directory -Path $ReleaseDir | Out-Null

Copy-Item -LiteralPath $InstallerPath -Destination (Join-Path $ReleaseDir $InstallerName)
Copy-Item -LiteralPath (Join-Path $Root "README.md") -Destination (Join-Path $ReleaseDir "README.md")
Copy-Item -LiteralPath (Join-Path $Root "ANDROID.md") -Destination (Join-Path $ReleaseDir "ANDROID.md")
Copy-Item -LiteralPath (Join-Path $Root "TROUBLESHOOTING.md") -Destination (Join-Path $ReleaseDir "TROUBLESHOOTING.md")

$InstallText = @"
FieldPulse Lite Windows installer

1. Run $InstallerName.
2. Open FieldPulse Lite from the Start Menu or desktop shortcut.
3. Use the setup page QR code to open the worker app on an Android phone.

Node.js is not required on the target PC.
ClickUp and email settings are optional and stay on the PC backend.

Troubleshooting:
- Read TROUBLESHOOTING.md for startup, logs, port conflicts, and database reset steps.
- Read ANDROID.md for phone/PWA setup.
"@

Set-Content -Path (Join-Path $ReleaseDir "INSTALL.txt") -Value $InstallText -Encoding UTF8

Write-Host "Created Windows release folder:"
Write-Host $ReleaseDir
