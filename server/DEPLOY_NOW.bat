@echo off
echo ========================================
echo DEPLOYING FIXED AUTO-POSTING CODE
echo ========================================
echo.
echo Image: scale112/pavan-client-backend:latest
echo.

cd /d "%~dp0"

echo Step 1: Building Docker image...
docker build -t scale112/pavan-client-backend:latest .

if %errorlevel% neq 0 (
    echo ERROR: Docker build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Pushing to Docker Hub...
docker push scale112/pavan-client-backend:latest

if %errorlevel% neq 0 (
    echo ERROR: Docker push failed!
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Image pushed to Docker Hub
echo ========================================
echo.
echo NEXT STEPS:
echo 1. Go to Azure Portal: https://portal.azure.com
echo 2. Find: pavan-client-backend-bxgdaqhvarfdeuhe
echo 3. Click RESTART in Overview
echo 4. Wait 3 minutes
echo 5. Check logs for: "Cron job registered"
echo.
pause
