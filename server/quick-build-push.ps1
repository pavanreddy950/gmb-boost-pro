# Quick Docker Build and Push Script
# Rebuilds backend with latest fixes and pushes to Docker Hub

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Backend Docker Rebuild and Push" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$dockerRepo = "scale112/pavan-client-backend"
$version = "v2.0.0"

# Step 1: Build
Write-Host "[1/4] Building Docker image..." -ForegroundColor Yellow
Write-Host "This may take 2-3 minutes..." -ForegroundColor Gray
docker build -t pavan-client-backend:latest .
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Image built`n" -ForegroundColor Green

# Step 2: Tag for Docker Hub
Write-Host "[2/4] Tagging images..." -ForegroundColor Yellow
docker tag pavan-client-backend:latest ${dockerRepo}:latest
docker tag pavan-client-backend:latest ${dockerRepo}:${version}
Write-Host "SUCCESS: Images tagged`n" -ForegroundColor Green

# Step 3: Login check
Write-Host "[3/4] Checking Docker Hub login..." -ForegroundColor Yellow
$loginCheck = docker info 2>&1 | Select-String "Username"
if (!$loginCheck) {
    Write-Host "You need to login to Docker Hub" -ForegroundColor Yellow
    Write-Host "Running: docker login`n" -ForegroundColor Gray
    docker login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "ERROR: Login failed" -ForegroundColor Red
        exit 1
    }
}
Write-Host "SUCCESS: Logged in to Docker Hub`n" -ForegroundColor Green

# Step 4: Push
Write-Host "[4/4] Pushing to Docker Hub..." -ForegroundColor Yellow
Write-Host "Pushing ${dockerRepo}:latest..." -ForegroundColor Gray
docker push ${dockerRepo}:latest
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Push failed!" -ForegroundColor Red
    exit 1
}
Write-Host "SUCCESS: Pushed latest tag" -ForegroundColor Green

Write-Host "`nPushing ${dockerRepo}:${version}..." -ForegroundColor Gray
docker push ${dockerRepo}:${version}
if ($LASTEXITCODE -ne 0) {
    Write-Host "WARNING: Version push failed" -ForegroundColor Yellow
} else {
    Write-Host "SUCCESS: Pushed version tag" -ForegroundColor Green
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Build and Push Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Docker Hub: https://hub.docker.com/r/scale112/pavan-client-backend`n" -ForegroundColor White

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Next: Update Azure App Service" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "1. Go to: https://portal.azure.com" -ForegroundColor White
Write-Host "2. Navigate to: App Services -> pavan-client-backend-bxgdaqhvarfdeuhe" -ForegroundColor White
Write-Host "3. Click: Deployment Center" -ForegroundColor White
Write-Host "4. Click: Settings tab" -ForegroundColor White
Write-Host "5. Verify:" -ForegroundColor White
Write-Host "   - Registry source: Docker Hub" -ForegroundColor Gray
Write-Host "   - Repository: scale112/pavan-client-backend" -ForegroundColor Gray
Write-Host "   - Tag: latest" -ForegroundColor Gray
Write-Host "   - Continuous Deployment: OFF (manual pull)" -ForegroundColor Gray
Write-Host "6. Click: Save" -ForegroundColor White
Write-Host "7. Go to: Overview tab" -ForegroundColor White
Write-Host "8. Click: Restart button" -ForegroundColor White
Write-Host "9. Wait 2-3 minutes" -ForegroundColor White
Write-Host "10. Test:" -ForegroundColor White
Write-Host "    https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health`n" -ForegroundColor Gray

Write-Host "TIP: Run check-backend-status.ps1 to verify deployment" -ForegroundColor Yellow
Write-Host ""
