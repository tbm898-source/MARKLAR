@echo off
title FieldPulse Lite Install
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install-FieldPulse.ps1"
if errorlevel 1 pause
