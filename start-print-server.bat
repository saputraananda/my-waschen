@echo off
title Waschen Print Server
color 0A

echo.
echo  ╔══════════════════════════════════════════════════════════════╗
echo  ║           WASCHEN PRINT SERVER v1.0.0                      ║
echo  ╚══════════════════════════════════════════════════════════════╝
echo.

cd /d "%~dp0"

echo [*] Checking Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js tidak ditemukan. Install dulu ya!
    echo    Download: https://nodejs.org/
    pause
    exit /b 1
)

echo [*] Node.js version:
node --version

echo.
echo [*] Installing print server dependencies...
call npm install escpos escpos-network serialport --save 2>nul

echo.
echo [*] Starting Print Server...
echo    Port: 3456
echo    URL: http://localhost:3456
echo.
echo    Tekan Ctrl+C untuk berhenti.
echo.

node print-server.js

pause
