@echo off
setlocal

cd /d "%~dp0"

echo.
echo Charis Outreach
echo ----------------

if not exist package.json (
  echo Could not find package.json. Please run this file from the charis-outreach folder.
  pause
  exit /b 1
)

where npm >nul 2>nul
if errorlevel 1 (
  echo npm was not found. Please install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist node_modules (
  echo Installing dependencies. This may take a few minutes the first time...
  call npm install
  if errorlevel 1 (
    echo.
    echo Dependency installation failed.
    pause
    exit /b 1
  )
) else (
  echo Dependencies found.
)

if not exist .env.local (
  if exist .env.example (
    echo.
    echo No .env.local file found.
    echo Creating .env.local from .env.example.
    copy .env.example .env.local >nul
    echo.
    echo IMPORTANT: Fill in .env.local with your Supabase values before using database features.
  )
)

echo.
echo Starting Charis Outreach...
echo Computer browser: http://localhost:3000
echo Phone browser: use the Network URL printed below, usually http://YOUR-WIFI-IP:3000
echo Press Ctrl+C in this window to stop the app.
echo.

start "" cmd /c "timeout /t 5 /nobreak >nul && start "" "http://localhost:3000""
call npm run dev -- --hostname 0.0.0.0

endlocal
