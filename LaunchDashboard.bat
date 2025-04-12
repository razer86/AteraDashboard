@echo off
setlocal EnableDelayedExpansion
cd /d "%~dp0"

echo ===============================
echo Atera Dashboard Launcher
echo ===============================

:: Check if node is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] Node.js is not installed.

    :: Check if winget is available
    where winget >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo [+] Winget found. Installing Node.js LTS via winget...
        winget install OpenJS.NodeJS.LTS --silent

        echo [~] Installation triggered. Restarting script...
        call "%~f0"
        exit /b
    ) else (
        echo [!] Winget not found.
        echo Please install Node.js manually from: https://nodejs.org/
        start https://nodejs.org/
        pause
        exit /b
    )
)

:: Check if npm is installed (sanity check)
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [!] npm is not available. Something went wrong with Node.js installation.
    pause
    exit /b
)

:: Check for package.json
if not exist package.json (
    echo [!] package.json not found. Creating it...
    echo {
    echo   "name": "atera-dashboard",
    echo   "version": "1.0.0",
    echo   "type": "module",
    echo   "dependencies": {
    echo     "dotenv": "^16.0.0",
    echo     "express": "^4.18.0",
    echo     "node-fetch": "^2.6.7"
    echo   }
    echo } > package.json
)

:: Install dependencies if needed
if not exist node_modules (
    echo [+] Installing dependencies...
    npm install
) else (
    echo [+] Dependencies already installed.
)

:: Start the dashboard
echo [+] Starting dashboard server...
start http://localhost:3001
npm start

pause
