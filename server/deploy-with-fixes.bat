@echo off
REM Deployment script for Pavan Client Backend with Payment Persistence Fixes
REM This script builds and pushes the updated Docker image to Docker Hub

echo 🚀 Pavan Client Backend - Deployment with Payment Fixes
echo ========================================================
echo.

REM Check if Docker is running
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Docker is not running. Please start Docker Desktop first.
    echo    1. Open Docker Desktop
    echo    2. Wait for it to fully start
    echo    3. Run this script again
    echo.
    pause
    exit /b 1
)

echo ✅ Docker is running
echo.

echo 📋 Changes included in this deployment:
echo    ✅ Payment persistence across logout/login sessions
echo    ✅ User ID-based subscription lookup
echo    ✅ Accurate trial day counting (fixed Math.ceil issue)
echo    ✅ User-GBP account mapping system
echo    ✅ Enhanced subscription status API
echo.

REM Build the image
echo 🏗️ Building Docker image with latest fixes...
docker-compose -f docker-compose.pavan-client.yml build --no-cache
if %errorlevel% neq 0 (
    echo ❌ Build failed
    pause
    exit /b 1
)

echo ✅ Build completed successfully
echo.

REM Tag for Docker Hub
echo 🏷️ Tagging image for Docker Hub...
docker tag pavan-client-backend:latest scale112/pavan-client-backend:latest
if %errorlevel% neq 0 (
    echo ❌ Tagging failed
    pause
    exit /b 1
)

echo ✅ Image tagged successfully
echo.

REM Check if logged in to Docker Hub
echo 🔐 Checking Docker Hub authentication...
docker info | findstr "Username" >nul
if %errorlevel% neq 0 (
    echo ⚠️ Not logged in to Docker Hub
    set /p login="Do you want to login now? (y/n): "
    if /i "%login%"=="y" (
        docker login
        if %errorlevel% neq 0 (
            echo ❌ Login failed
            pause
            exit /b 1
        )
    ) else (
        echo ❌ Cannot push without authentication
        pause
        exit /b 1
    )
)

echo ✅ Docker Hub authentication confirmed
echo.

REM Push to Docker Hub
echo 📤 Pushing to Docker Hub: scale112/pavan-client-backend:latest...
docker push scale112/pavan-client-backend:latest
if %errorlevel% neq 0 (
    echo ❌ Push failed
    pause
    exit /b 1
)

echo ✅ Successfully pushed to Docker Hub!
echo.

echo 🎉 Deployment Summary:
echo =====================
echo ✅ Image built with payment persistence fixes
echo ✅ Image tagged as scale112/pavan-client-backend:latest
echo ✅ Image pushed to Docker Hub successfully
echo.

echo 🌐 Docker Hub Repository:
echo    https://hub.docker.com/r/scale112/pavan-client-backend
echo.

echo 📋 To pull this updated container:
echo    docker pull scale112/pavan-client-backend:latest
echo.

echo 🚀 To run this container:
echo    docker run -d -p 5000:5000 --name pavan-client scale112/pavan-client-backend:latest
echo.

echo 🔄 To update existing deployments:
echo    1. Stop current container: docker stop pavan-client
echo    2. Remove old container: docker rm pavan-client
echo    3. Pull latest image: docker pull scale112/pavan-client-backend:latest
echo    4. Run new container with same command above
echo.

echo ✨ Deployment completed successfully!
pause