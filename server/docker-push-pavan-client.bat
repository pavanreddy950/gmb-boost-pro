@echo off
REM Pavan Client Docker Hub Push Script (Windows)
REM This batch file pushes the pavan-client container to Docker Hub

echo.
echo 🚀 Pavan Client Docker Hub Push
echo ================================

REM Docker Hub configuration
set DOCKER_USERNAME=scale112
set IMAGE_NAME=pavan-client-backend
set DOCKER_REPO=%DOCKER_USERNAME%/%IMAGE_NAME%

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker first.
    exit /b 1
)

REM Check if image exists
docker images | findstr "pavan-client-backend" >nul
if %errorlevel% neq 0 (
    echo ❌ pavan-client-backend image not found. Please build it first.
    echo Run: docker-compose -f docker-compose.pavan-client.yml build
    exit /b 1
)

echo 📋 Current pavan-client images:
docker images | findstr pavan-client

echo.
echo 🔍 Checking Docker Hub authentication...
docker info | findstr "Username" >nul
if %errorlevel% neq 0 (
    echo ⚠️ Not logged in to Docker Hub. Please run:
    echo    docker login
    echo.
    set /p login="Do you want to login now? (y/n): "
    if /i "%login%"=="y" (
        docker login
        if %errorlevel% neq 0 (
            echo ❌ Login failed
            exit /b 1
        )
    ) else (
        echo ❌ Cannot push without Docker Hub authentication
        exit /b 1
    )
)

echo.
echo 🏷️ Available tags to push:
docker images | findstr scale112/pavan-client-backend

echo.
echo 📤 Starting push process...

REM Push latest tag
echo 📤 Pushing %DOCKER_REPO%:latest...
docker push %DOCKER_REPO%:latest
if %errorlevel% equ 0 (
    echo ✅ Successfully pushed %DOCKER_REPO%:latest
    set PUSHED_LATEST=true
) else (
    echo ❌ Failed to push %DOCKER_REPO%:latest
    set PUSHED_LATEST=false
)

REM Push versioned tag if it exists
docker images | findstr "scale112/pavan-client-backend.*v1.0.0" >nul
if %errorlevel% equ 0 (
    echo 📤 Pushing %DOCKER_REPO%:v1.0.0...
    docker push %DOCKER_REPO%:v1.0.0
    if %errorlevel% equ 0 (
        echo ✅ Successfully pushed %DOCKER_REPO%:v1.0.0
        set PUSHED_VERSION=true
    ) else (
        echo ❌ Failed to push %DOCKER_REPO%:v1.0.0
        set PUSHED_VERSION=false
    )
) else (
    set PUSHED_VERSION=false
)

REM Summary
echo.
echo 📊 Push Summary:
echo ================
if "%PUSHED_LATEST%"=="true" (
    echo ✅ Latest tag pushed successfully
) else (
    echo ❌ Latest tag push failed
)

if "%PUSHED_VERSION%"=="true" (
    echo ✅ Version v1.0.0 tag pushed successfully
)

echo.
echo 🌐 Docker Hub Repository: https://hub.docker.com/r/%DOCKER_USERNAME%/%IMAGE_NAME%
echo.
echo 📋 To pull this container:
echo    docker pull %DOCKER_REPO%:latest
echo    # or
echo    docker pull %DOCKER_REPO%:v1.0.0
echo.
echo 🚀 To run this container:
echo    docker run -d -p 5000:5000 --name pavan-client %DOCKER_REPO%:latest
echo.

if "%PUSHED_LATEST%"=="true" (
    echo 🎉 Push completed successfully!
) else (
    echo ❌ Push failed
)

echo.