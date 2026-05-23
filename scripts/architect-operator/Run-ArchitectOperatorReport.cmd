@echo off
set "HERE=%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%HERE%Invoke-ArchitectOperatorReport.ps1" %*
