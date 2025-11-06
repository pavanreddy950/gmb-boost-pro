#!/usr/bin/env pwsh
# Backend Docker Deployment Script
# This script deploys ONLY the backend to Docker Hub

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Backend Docker Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Switch to Azure environment
Write-Host "Step 1: Switching to Azure environment..." -ForegroundColor Yellow
node switch-env.js azure
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to switch environment!" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Step 2: Build Docker image
Write-Host "Step 2: Building Docker image..." -ForegroundColor Yellow
Set-Location server
docker build -t lobaiseo-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host ""

# Step 3: Tag for Docker Hub
Write-Host "Step 3: Tagging image for Docker Hub..." -ForegroundColor Yellow
docker tag lobaiseo-backend:latest scale112/lobaiseo-backend:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker tag failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host ""

# Step 4: Check Docker login
Write-Host "Step 4: Checking Docker Hub login..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1 | Out-String
if ($dockerInfo -notmatch "Username") {
    Write-Host "Not logged in to Docker Hub!" -ForegroundColor Red
    Write-Host "Please run: docker login" -ForegroundColor Yellow
    Write-Host "Username: scale112" -ForegroundColor Gray
    Set-Location ..
    exit 1
}
Write-Host "Logged in to Docker Hub" -ForegroundColor Green
Write-Host ""

# Step 5: Push to Docker Hub
Write-Host "Step 5: Pushing to Docker Hub..." -ForegroundColor Yellow
docker push scale112/lobaiseo-backend:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker push failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host ""

# Return to project root
Set-Location ..

Write-Host "======================================" -ForegroundColor Green
Write-Host "  Backend Deployment Complete! ✅" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend Image: scale112/lobaiseo-backend:latest" -ForegroundColor White
Write-Host "Docker Hub URL: https://hub.docker.com/r/scale112/lobaiseo-backend" -ForegroundColor White
Write-Host ""
Write-Host "To pull on server: docker pull scale112/lobaiseo-backend:latest" -ForegroundColor Gray
Write-Host ""
