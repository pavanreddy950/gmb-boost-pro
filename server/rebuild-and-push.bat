@echo off
REM Complete Rebuild and Push Script for Pavan Client Backend
REM This script: 1) Builds Docker image 2) Tags for Docker Hub 3) Pushes to Docker Hub

echo.
echo ========================================
echo   Pavan Client Backend - Rebuild and Push
echo ========================================
echo.

REM Configuration
set DOCKER_USERNAME=scale112
set IMAGE_NAME=pavan-client-backend
set LOCAL_IMAGE=%IMAGE_NAME%:latest
set DOCKER_REPO=%DOCKER_USERNAME%/%IMAGE_NAME%
set VERSION=v2.0.0

echo [1/5] Checking Docker status...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker is not running. Please start Docker Desktop first.
    exit /b 1
)
echo SUCCESS: Docker is running
echo.

echo [2/5] Building Docker image...
echo Building from Dockerfile with latest fixes...
docker build -t %LOCAL_IMAGE% .
if %errorlevel% neq 0 (
    echo ERROR: Docker build failed
    exit /b 1
)
echo SUCCESS: Docker image built successfully
echo.

echo [3/5] Tagging images for Docker Hub...
docker tag %LOCAL_IMAGE% %DOCKER_REPO%:latest
if %errorlevel% neq 0 (
    echo ERROR: Failed to tag image with 'latest'
    exit /b 1
)
echo SUCCESS: Tagged as %DOCKER_REPO%:latest

docker tag %LOCAL_IMAGE% %DOCKER_REPO%:%VERSION%
if %errorlevel% neq 0 (
    echo WARNING: Failed to tag image with version %VERSION%
) else (
    echo SUCCESS: Tagged as %DOCKER_REPO%:%VERSION%
)
echo.

echo [4/5] Checking Docker Hub authentication...
docker info | findstr "Username" >nul
if %errorlevel% neq 0 (
    echo Not logged in to Docker Hub
    echo Please login now:
    docker login
    if %errorlevel% neq 0 (
        echo ERROR: Login failed
        exit /b 1
    )
)
echo SUCCESS: Authenticated with Docker Hub
echo.

echo [5/5] Pushing images to Docker Hub...
echo.
echo Pushing %DOCKER_REPO%:latest...
docker push %DOCKER_REPO%:latest
if %errorlevel% neq 0 (
    echo ERROR: Failed to push latest tag
    exit /b 1
)
echo SUCCESS: Pushed %DOCKER_REPO%:latest
echo.

echo Pushing %DOCKER_REPO%:%VERSION%...
docker push %DOCKER_REPO%:%VERSION%
if %errorlevel% neq 0 (
    echo WARNING: Failed to push version tag
) else (
    echo SUCCESS: Pushed %DOCKER_REPO%:%VERSION%
)
echo.

echo ========================================
echo   Build and Push Complete!
echo ========================================
echo.
echo Docker Hub: https://hub.docker.com/r/%DOCKER_USERNAME%/%IMAGE_NAME%
echo.
echo Images available:
echo   - %DOCKER_REPO%:latest
echo   - %DOCKER_REPO%:%VERSION%
echo.
echo ========================================
echo   Next Steps for Azure Deployment
echo ========================================
echo.
echo 1. Go to Azure Portal: https://portal.azure.com
echo.
echo 2. Navigate to your App Service:
echo    App Services -^> pavan-client-backend-bxgdaqhvarfdeuhe
echo.
echo 3. Go to Deployment Center
echo.
echo 4. Update Container Settings:
echo    - Registry source: Docker Hub
echo    - Repository: scale112/pavan-client-backend
echo    - Tag: latest
echo.
echo 5. Add/Verify Application Settings in Configuration:
echo    - WEBSITE_PORT = 5000
echo    - NODE_ENV = production
echo    - RUN_MODE = AZURE
echo    - All other env variables from docker-compose.pavan-client.yml
echo.
echo 6. Save and restart the App Service
echo.
echo 7. Test after 2-3 minutes:
echo    https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
echo.
pause
