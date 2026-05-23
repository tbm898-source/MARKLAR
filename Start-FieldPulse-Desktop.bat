@echo off
title FieldPulse Lite Desktop
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

if not exist "backend\dist\index.js" (
  echo Backend not built yet. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo Frontend not built yet. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

if not exist "electron\node_modules\electron" (
  echo Desktop dependencies are not installed. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

echo.
echo  Starting FieldPulse Lite Desktop...
echo.

npm run desktop:start
