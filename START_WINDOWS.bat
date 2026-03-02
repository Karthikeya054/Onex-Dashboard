@echo off
setlocal
cd /d "%~dp0"

echo ==========================================
echo        CDU DASHBOARD STARTUP
echo ==========================================
echo.

:: 1. Verify Node
echo Checking Node version...
call node -v >nul 2>&1
if %errorlevel% neq 0 (
    echo [!!!] ERROR: Node.js is NOT installed or not in PATH.
    echo Please download and install from https://nodejs.org/
    echo Once installed, RESTART your computer and try again.
    echo.
    pause
    exit /b
)

:: 2. Verify Folder
if not exist "package.json" (
    echo [!!!] ERROR: Files missing! 
    echo Did you extract the ZIP file? 
    echo You must right-click the ZIP and choose 'Extract All' first.
    echo.
    pause
    exit /b
)

:: 3. Setup dependencies
if not exist "node_modules" (
    echo.
    echo Initializing app for the first time...
    echo This will take a few minutes. Please do not close this window.
    echo.
    call npm install
    call npx playwright install chromium
)

echo.
echo [ SUCCESS ]
echo Opening dashboard at http://localhost:3001
echo.
start http://localhost:3001
call npm run dev -- -p 3001

echo.
echo Dashboard has stopped.
pause
