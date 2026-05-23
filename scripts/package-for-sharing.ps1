# Creates FieldPulse-Lite.zip for sharing (excludes node_modules, db, secrets)
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Out = Join-Path (Get-Location) "FieldPulse-Lite.zip"

if (Test-Path $Out) { Remove-Item $Out -Force }

$staging = Join-Path $env:TEMP "fieldpulse-lite-staging"
if (Test-Path $staging) { Remove-Item $staging -Recurse -Force }
New-Item -ItemType Directory -Path $staging | Out-Null

robocopy $Root $staging /E /XD node_modules backend\node_modules frontend\node_modules electron\node_modules backend\data backend\dist frontend\dist electron\dist electron\bundled canonical-hub\dist .git /XF .env *.sqlite *.sqlite-* *.db *.db-* *.log *.exe *.msi *.msix *.appx *.blockmap *.asar *.zip *.7z /NFL /NDL /NJH /NJS | Out-Null

Compress-Archive -Path "$staging\*" -DestinationPath $Out -Force
Remove-Item $staging -Recurse -Force

Write-Host "Created: $Out"
Write-Host "Recipient: unzip, run Install-FieldPulse.bat"
