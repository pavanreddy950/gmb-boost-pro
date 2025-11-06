#!/usr/bin/env pwsh
# Full Code Git Deployment Script
# This script commits and pushes ALL code to GitHub

param(
    [string]$Message = "Deploy: Updated code"
)

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Full Code Git Deployment" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check Git status
Write-Host "Step 1: Checking Git status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain
if ([string]::IsNullOrEmpty($gitStatus)) {
    Write-Host "No changes to commit!" -ForegroundColor Yellow
    exit 0
}
Write-Host "Changes detected:" -ForegroundColor Green
git status --short
Write-Host ""

# Step 2: Add all changes
Write-Host "Step 2: Adding all changes..." -ForegroundColor Yellow
git add .
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git add failed!" -ForegroundColor Red
    exit 1
}
Write-Host "All changes staged" -ForegroundColor Green
Write-Host ""

# Step 3: Commit changes
Write-Host "Step 3: Committing changes..." -ForegroundColor Yellow
Write-Host "Commit message: $Message" -ForegroundColor Gray
git commit -m "$Message"
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git commit failed!" -ForegroundColor Red
    exit 1
}
Write-Host "Changes committed" -ForegroundColor Green
Write-Host ""

# Step 4: Push to GitHub
Write-Host "Step 4: Pushing to GitHub..." -ForegroundColor Yellow
git push origin main
if ($LASTEXITCODE -ne 0) {
    Write-Host "Git push failed!" -ForegroundColor Red
    Write-Host "You may need to pull first: git pull origin main" -ForegroundColor Yellow
    exit 1
}
Write-Host ""

Write-Host "======================================" -ForegroundColor Green
Write-Host "  Git Deployment Complete! ✅" -ForegroundColor Green
Write-Host "======================================" -ForegroundColor Green
Write-Host ""
Write-Host "Repository: https://github.com/pavanreddy950/gmb-boost-pro.git" -ForegroundColor White
Write-Host "Commit: $Message" -ForegroundColor White
Write-Host ""
