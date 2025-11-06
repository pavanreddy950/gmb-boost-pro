#!/usr/bin/env pwsh
# Complete Deployment Script
# This script:
# 1. Switches to Azure environment
# 2. Deploys backend to Docker Hub
# 3. Pushes all code to GitHub

param(
    [string]$CommitMessage = "Deploy: Updated backend and code"
)

Write-Host "========================================" -ForegroundColor Magenta
Write-Host "  COMPLETE DEPLOYMENT WORKFLOW" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# Part 1: Deploy Backend to Docker
Write-Host "PART 1: BACKEND DOCKER DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Switch to Azure environment
Write-Host "[1/5] Switching to Azure environment..." -ForegroundColor Yellow
node switch-env.js azure
if ($LASTEXITCODE -ne 0) {
    Write-Host "Failed to switch environment!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Environment switched to Azure" -ForegroundColor Green
Write-Host ""

# Build Docker image
Write-Host "[2/5] Building Docker image..." -ForegroundColor Yellow
Set-Location server
docker build -t lobaiseo-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker build failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Docker image built" -ForegroundColor Green
Write-Host ""

# Tag for Docker Hub
Write-Host "[3/5] Tagging for Docker Hub..." -ForegroundColor Yellow
docker tag lobaiseo-backend:latest scale112/lobaiseo-backend:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker tag failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Image tagged: scale112/lobaiseo-backend:latest" -ForegroundColor Green
Write-Host ""

# Check Docker login
Write-Host "[4/5] Checking Docker Hub login..." -ForegroundColor Yellow
$dockerInfo = docker info 2>&1 | Out-String
if ($dockerInfo -notmatch "Username") {
    Write-Host "❌ Not logged in to Docker Hub!" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please run: docker login" -ForegroundColor Yellow
    Write-Host "Username: scale112" -ForegroundColor Gray
    Write-Host "Then run this script again." -ForegroundColor Gray
    Set-Location ..
    exit 1
}
Write-Host "✅ Docker Hub authenticated" -ForegroundColor Green
Write-Host ""

# Push to Docker Hub
Write-Host "[5/5] Pushing to Docker Hub..." -ForegroundColor Yellow
docker push scale112/lobaiseo-backend:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker push failed!" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Write-Host "✅ Backend pushed to Docker Hub" -ForegroundColor Green
Write-Host ""

# Return to project root
Set-Location ..

Write-Host "========================================" -ForegroundColor Green
Write-Host "  BACKEND DEPLOYMENT COMPLETE ✅" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

# Part 2: Push All Code to GitHub
Write-Host ""
Write-Host "PART 2: GIT DEPLOYMENT" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check Git status
Write-Host "[1/3] Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ([string]::IsNullOrEmpty($gitStatus)) {
    Write-Host "No changes to commit" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  DEPLOYMENT COMPLETE! ✅" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Backend: https://hub.docker.com/r/scale112/lobaiseo-backend" -ForegroundColor White
    Write-Host "No Git changes to push" -ForegroundColor White
    exit 0
}
Write-Host "Changes detected:" -ForegroundColor Green
git status --short
Write-Host ""

# Add and commit
Write-Host "[2/3] Committing changes..." -ForegroundColor Yellow
git add .
git commit -m "$CommitMessage"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git commit failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Changes committed" -ForegroundColor Green
Write-Host ""

# Push to GitHub
Write-Host "[3/3] Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed!" -ForegroundColor Red
    Write-Host "Try: git pull origin main --rebase" -ForegroundColor Yellow
    exit 1
}
Write-Host "✅ Code pushed to GitHub" -ForegroundColor Green
Write-Host ""

Write-Host "========================================" -ForegroundColor Green
Write-Host "  DEPLOYMENT COMPLETE! ✅✅✅" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Backend Docker:" -ForegroundColor White
Write-Host "  📦 Image: scale112/lobaiseo-backend:latest" -ForegroundColor Gray
Write-Host "  🌐 URL: https://hub.docker.com/r/scale112/lobaiseo-backend" -ForegroundColor Gray
Write-Host ""
Write-Host "GitHub:" -ForegroundColor White
Write-Host "  📂 Repo: https://github.com/pavanreddy950/gmb-boost-pro.git" -ForegroundColor Gray
Write-Host "  💬 Commit: $CommitMessage" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Pull Docker image on server: docker pull scale112/lobaiseo-backend:latest" -ForegroundColor White
Write-Host "  2. Restart Docker container on server" -ForegroundColor White
Write-Host "  3. Verify deployment: https://www.app.lobaiseo.com" -ForegroundColor White
Write-Host ""
