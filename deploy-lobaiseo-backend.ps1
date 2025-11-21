#!/usr/bin/env pwsh
# Deploy Lobaiseo Backend Container
# This script creates and runs a fresh "lobaiseo-backend" container

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Lobaiseo Backend Container Setup" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Navigate to server directory
Set-Location server

# Step 1: Stop and remove any existing container with the same name
Write-Host "Step 1: Cleaning up existing containers..." -ForegroundColor Yellow
$existingContainer = docker ps -a --filter "name=lobaiseo-backend" --format "{{.Names}}" 2>$null
if ($existingContainer -eq "lobaiseo-backend") {
    Write-Host "Stopping existing container..." -ForegroundColor Yellow
    docker stop lobaiseo-backend 2>$null
    Write-Host "Removing existing container..." -ForegroundColor Yellow
    docker rm lobaiseo-backend 2>$null
    Write-Host "Old container removed" -ForegroundColor Green
} else {
    Write-Host "No existing container found" -ForegroundColor Green
}
Write-Host ""

# Step 2: Remove old image (optional, for a completely fresh build)
Write-Host "Step 2: Removing old image (if exists)..." -ForegroundColor Yellow
docker rmi lobaiseo-backend:latest 2>$null
docker rmi scale112/lobaiseo-backend:latest 2>$null
Write-Host "Old images cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Build new Docker image
Write-Host "Step 3: Building fresh Docker image..." -ForegroundColor Yellow
docker build -t lobaiseo-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "Image built successfully" -ForegroundColor Green
Write-Host ""

# Step 4: Start the container using docker-compose
Write-Host "Step 4: Starting lobaiseo-backend container..." -ForegroundColor Yellow
docker-compose -f docker-compose.lobaiseo-backend.yml up -d
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to start container!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host ""

# Step 5: Verify container is running
Write-Host "Step 5: Verifying container status..." -ForegroundColor Yellow
Start-Sleep -Seconds 3
$containerStatus = docker ps --filter "name=lobaiseo-backend" --format "{{.Status}}"
if ($containerStatus) {
    Write-Host "Container Status: $containerStatus" -ForegroundColor Green
} else {
    Write-Host "Warning: Container may not be running properly!" -ForegroundColor Red
}
Write-Host ""

# Return to project root
Set-Location ..

Write-Host "======================================" -ForegroundColor Green
Write-Host "  Container Deployed Successfully! ✅" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Container Name: lobaiseo-backend" -ForegroundColor White
Write-Host "Ports: 5000:5000, 8080:8080" -ForegroundColor White
Write-Host "Network: lobaiseo-network" -ForegroundColor White
Write-Host ""
Write-Host "Useful Commands:" -ForegroundColor Cyan
Write-Host "  View logs:    docker logs lobaiseo-backend -f" -ForegroundColor Gray
Write-Host "  Stop:         docker stop lobaiseo-backend" -ForegroundColor Gray
Write-Host "  Restart:      docker restart lobaiseo-backend" -ForegroundColor Gray
Write-Host "  Remove:       docker rm lobaiseo-backend" -ForegroundColor Gray
Write-Host "  Shell access: docker exec -it lobaiseo-backend sh" -ForegroundColor Gray
Write-Host ""
