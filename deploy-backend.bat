@echo off
REM Backend Deployment Script for Azure (Windows)
REM This script builds and pushes ONLY the backend Docker image

setlocal enabledelayedexpansion

echo =========================================
echo 🚀 BACKEND DEPLOYMENT TO DOCKER HUB
echo =========================================
echo.

REM Configuration
set DOCKER_REPO=scale112/pavan-client-backend
set TAG=latest
set FULL_IMAGE=%DOCKER_REPO%:%TAG%

echo 📦 Docker Image: %FULL_IMAGE%
echo 📁 Build Context: ./server
echo.

REM Step 1: Verify environment is in AZURE mode
echo 🔍 Checking environment configuration...
if not exist "server\.env" (
    echo ❌ ERROR: server\.env file not found!
    echo Please run: npm run switch:azure
    exit /b 1
)

findstr /C:"RUN_MODE=AZURE" server\.env >nul
if %errorlevel% equ 0 (
    echo ✅ Environment is in AZURE mode
) else (
    echo ⚠️  WARNING: server\.env might not be in AZURE mode
    echo Current RUN_MODE:
    findstr "RUN_MODE" server\.env
    echo.
)
echo.

REM Step 2: Verify Dockerfile exists
if not exist "server\Dockerfile" (
    echo ❌ ERROR: server\Dockerfile not found!
    exit /b 1
)
echo ✅ Dockerfile found
echo.

REM Step 3: Check Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker is not running!
    echo Please start Docker Desktop and try again
    exit /b 1
)
echo ✅ Docker is running
echo.

REM Step 4: Build the Docker image
echo =========================================
echo 🔨 BUILDING DOCKER IMAGE
echo =========================================
echo.
cd server
docker build -t %FULL_IMAGE% -f Dockerfile .
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker build failed!
    cd ..
    exit /b 1
)
cd ..
echo.
echo ✅ Docker image built successfully
echo.

REM Step 5: Push to Docker Hub
echo =========================================
echo 📤 PUSHING TO DOCKER HUB
echo =========================================
echo.
echo Checking Docker Hub authentication...
docker push %FULL_IMAGE%
if %errorlevel% neq 0 (
    echo ❌ ERROR: Docker push failed!
    echo Please login to Docker Hub:
    docker login
    echo.
    echo Then run this script again
    exit /b 1
)
echo.
echo ✅ Successfully pushed to Docker Hub: %FULL_IMAGE%
echo.

REM Step 6: Completion message
echo =========================================
echo ✅ DEPLOYMENT COMPLETE
echo =========================================
echo.
echo Next steps:
echo 1. Go to Azure Portal: https://portal.azure.com
echo 2. Navigate to: App Services ^> pavan-client-backend-bxgdaqhvarfdeuhe
echo 3. Click 'Restart' button at the top
echo 4. Wait 3-5 minutes for the service to pull the new image
echo 5. Test your application at: https://www.app.lobaiseo.com
echo.
echo 🔍 Azure Deployment Center should be configured with:
echo    Source: Docker Hub
echo    Image: %FULL_IMAGE%
echo    Continuous Deployment: ON
echo.
pause
