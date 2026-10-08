@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Newton Property
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\start-desk.ps1"
if errorlevel 1 pause
