@echo off
title FieldPulse Lite
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo Node.js is not installed. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

if not exist "frontend\dist\index.html" (
  echo App not built yet. Run Install-FieldPulse.bat first.
  pause
  exit /b 1
)

echo.
echo  Starting FieldPulse Lite...
echo  Keep this window open while testing.
echo.

start "" cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:3001/setup"

npm run start

