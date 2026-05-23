# Builds the FieldPulse Lite Windows desktop installer with Electron.
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $PSScriptRoot
$ElectronDir = Join-Path $Root "electron"
$BundleDir = Join-Path $ElectronDir "bundled"
$DistDir = Join-Path $ElectronDir "dist"

function Assert-ChildPath {
  param(
    [Parameter(Mandatory = $true)][string]$Child,
    [Parameter(Mandatory = $true)][string]$Parent
  )

  $childFull = [System.IO.Path]::GetFullPath($Child)
  $parentFull = [System.IO.Path]::GetFullPath($Parent)
  if (-not $childFull.StartsWith($parentFull, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to modify path outside expected parent: $childFull"
  }
}

function Remove-TreeWithRetry {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if (-not (Test-Path $Path)) { return }

  for ($attempt = 1; $attempt -le 8; $attempt++) {
    try {
      Remove-Item -LiteralPath $Path -Recurse -Force
      return
    }
    catch {
      if ($attempt -eq 8) { throw }
      Start-Sleep -Milliseconds (250 * $attempt)
    }
  }
}

Assert-ChildPath -Child $BundleDir -Parent $ElectronDir
Assert-ChildPath -Child $DistDir -Parent $ElectronDir

Push-Location $Root
try {
  Write-Host "Building frontend and backend..." -ForegroundColor Cyan
  npm run build
  if ($LASTEXITCODE -ne 0) { throw "npm run build failed" }

  Write-Host "Installing desktop tooling..." -ForegroundColor Cyan
  npm install --prefix electron
  if ($LASTEXITCODE -ne 0) { throw "npm install --prefix electron failed" }

  Write-Host "Preparing Electron bundle..." -ForegroundColor Cyan
  Remove-TreeWithRetry -Path $BundleDir
  Remove-TreeWithRetry -Path $DistDir

  New-Item -ItemType Directory -Path (Join-Path $BundleDir "backend") -Force | Out-Null
  New-Item -ItemType Directory -Path (Join-Path $BundleDir "frontend") -Force | Out-Null

  Copy-Item -LiteralPath (Join-Path $Root ".env.example") -Destination (Join-Path $BundleDir ".env.example") -Force
  Copy-Item -LiteralPath (Join-Path $Root "backend\package.json") -Destination (Join-Path $BundleDir "backend\package.json") -Force
  Copy-Item -LiteralPath (Join-Path $Root "backend\package-lock.json") -Destination (Join-Path $BundleDir "backend\package-lock.json") -Force
  Copy-Item -LiteralPath (Join-Path $Root "backend\dist") -Destination (Join-Path $BundleDir "backend\dist") -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $Root "frontend\dist") -Destination (Join-Path $BundleDir "frontend\dist") -Recurse -Force

  Write-Host "Installing packaged backend dependencies..." -ForegroundColor Cyan
  npm install --omit=dev --prefix (Join-Path $BundleDir "backend")
  if ($LASTEXITCODE -ne 0) { throw "packaged backend npm install failed" }

  $electronVersion = node -p "require('./electron/node_modules/electron/package.json').version"
  Write-Host "Rebuilding SQLite native module for Electron $electronVersion..." -ForegroundColor Cyan
  & (Join-Path $ElectronDir "node_modules\.bin\electron-rebuild.cmd") --version $electronVersion --module-dir (Join-Path $BundleDir "backend") --only better-sqlite3 --force
  if ($LASTEXITCODE -ne 0) { throw "electron-rebuild failed" }

  Write-Host "Creating Windows installer..." -ForegroundColor Cyan
  npm run dist --prefix electron
  if ($LASTEXITCODE -ne 0) { throw "electron-builder failed" }

  $electronPackage = Get-Content (Join-Path $ElectronDir "package.json") -Raw | ConvertFrom-Json
  $installerPath = Join-Path $DistDir "FieldPulse-Lite-Setup-$($electronPackage.version).exe"

  Write-Host ""
  Write-Host "Installer output: $installerPath" -ForegroundColor Green
}
finally {
  Pop-Location
}
