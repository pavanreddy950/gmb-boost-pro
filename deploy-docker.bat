@echo off
echo ======================================
echo   Backend Docker Deployment
echo ======================================
echo.

echo Step 1: Docker Login
docker login
if %errorlevel% neq 0 (
    echo Docker login failed!
    exit /b 1
)
echo.

echo Step 2: Building Docker image...
cd server
docker build -t pavan-client-backend:latest .
if %errorlevel% neq 0 (
    echo Docker build failed!
    cd ..
    exit /b 1
)
echo.

echo Step 3: Tagging image for Docker Hub...
docker tag pavan-client-backend:latest scale112/pavan-client-backend:latest
if %errorlevel% neq 0 (
    echo Docker tag failed!
    cd ..
    exit /b 1
)
echo.

echo Step 4: Pushing to Docker Hub...
docker push scale112/pavan-client-backend:latest
if %errorlevel% neq 0 (
    echo Docker push failed!
    cd ..
    exit /b 1
)
echo.

cd ..

echo ======================================
echo   Backend Deployment Complete!
echo ======================================
echo.
echo Backend Image: scale112/pavan-client-backend:latest
echo.

echo Step 5: Pushing to Git...
git add .
git commit -m "Backend Docker deployment and code updates"
git push origin main
if %errorlevel% neq 0 (
    echo Trying master branch...
    git push origin master
)
echo.

echo ======================================
echo   All Deployments Complete!
echo ======================================
