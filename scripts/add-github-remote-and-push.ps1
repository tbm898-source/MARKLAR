#Requires -Version 5.1
param(
  [Parameter(Mandatory = $true)]
  [string]$RemoteUrl,
  [string]$Branch = 'master'
)
$ErrorActionPreference = 'Stop'
# Repo root = parent of scripts/
$root = Split-Path $PSScriptRoot -Parent
Set-Location $root

$existing = git remote get-url origin 2>$null
if ($LASTEXITCODE -eq 0) {
  git remote set-url origin $RemoteUrl
  Write-Host "Updated origin -> $RemoteUrl"
}
else {
  git remote add origin $RemoteUrl
  Write-Host "Added origin -> $RemoteUrl"
}

git push -u origin $Branch
Write-Host "Done: pushed $Branch to origin"
