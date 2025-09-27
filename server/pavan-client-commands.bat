@echo off
REM Pavan Client Backend Container Management (Windows)
REM This batch file manages the pavan-client Docker container on Windows

echo.
echo 🚀 Pavan Client Backend Container Management
echo ============================================
echo.

if "%1"=="" goto :usage

if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="restart" goto :restart
if "%1"=="logs" goto :logs
if "%1"=="status" goto :status
if "%1"=="stats" goto :stats
if "%1"=="health" goto :health
goto :usage

:start
echo 🏗️ Building and starting pavan-client container...
echo.
echo 🛑 Stopping existing container (if any)...
docker-compose -f docker-compose.pavan-client.yml down >nul 2>&1

echo 🗑️ Removing existing image (if any)...
docker rmi pavan-client-backend:latest >nul 2>&1

echo 🔨 Building new container...
docker-compose -f docker-compose.pavan-client.yml build --no-cache

echo ▶️ Starting container...
docker-compose -f docker-compose.pavan-client.yml up -d

echo ⏳ Waiting for container to be healthy...
timeout /t 15 /nobreak >nul

echo.
echo 🎉 Pavan-client container started successfully!
echo 🌐 Backend available at: http://localhost:5000
echo ❤️ Health check: http://localhost:5000/health
echo ⚙️ Config check: http://localhost:5000/config
echo.
echo 📋 Initial logs:
docker-compose -f docker-compose.pavan-client.yml logs --tail=10 backend
goto :end

:stop
echo 🛑 Stopping pavan-client container...
docker-compose -f docker-compose.pavan-client.yml down
echo ✅ Container stopped
goto :end

:restart
echo 🔄 Restarting pavan-client container...
call %0 stop
timeout /t 3 /nobreak >nul
call %0 start
goto :end

:logs
echo 📋 Showing logs for pavan-client container...
docker-compose -f docker-compose.pavan-client.yml logs -f --tail=50 backend
goto :end

:status
echo 📊 Checking pavan-client container status...
docker ps | findstr "pavan-client" >nul
if %errorlevel%==0 (
    echo ✅ Container 'pavan-client' is running
    echo 🌐 Backend URL: http://localhost:5000
    echo ❤️ Health check: http://localhost:5000/health
) else (
    echo ❌ Container 'pavan-client' is not running
)
goto :end

:stats
echo 📊 Container statistics:
docker ps | findstr "pavan-client" >nul
if %errorlevel%==0 (
    docker stats pavan-client --no-stream
) else (
    echo ❌ Container is not running
)
goto :end

:health
echo 🏥 Checking health endpoint...
curl -f http://localhost:5000/health
if %errorlevel%==0 (
    echo.
    echo ✅ Health check passed
) else (
    echo.
    echo ❌ Health check failed
)
goto :end

:usage
echo Usage: %0 {start^|stop^|restart^|logs^|status^|stats^|health}
echo.
echo Commands:
echo   start   - Build and start the pavan-client container
echo   stop    - Stop the container  
echo   restart - Restart the container
echo   logs    - Show container logs
echo   status  - Check if container is running
echo   stats   - Show container resource usage
echo   health  - Test the health endpoint
echo.
echo Examples:
echo   %0 start    # Start the container
echo   %0 logs     # View logs
echo   %0 status   # Check status
echo.

:end
echo.