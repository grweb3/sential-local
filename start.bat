@echo off
echo ======================================================
echo 🚀 Booting Sential AI Local Engine...
echo ======================================================
echo.
echo Pulling containers and building local dependencies...

:: Try modern 'docker compose' first, fallback to legacy 'docker-compose' if needed
docker compose up --build -d 2>nul || docker-compose up --build -d

echo.
echo 🌐 Waiting for Sential Cortex to initialize...
timeout /t 8 >nul

echo Opening Sential in your default browser...
start http://localhost:5173

echo.
echo ======================================================
echo ✅ SYSTEM LIVE. DO NOT CLOSE THIS WINDOW.
echo Type 'docker compose down' in another terminal to stop.
echo ======================================================
pause