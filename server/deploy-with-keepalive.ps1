# Deploy Updated Backend with Keep-Alive Service to Azure
# PowerShell version for Windows

Write-Host "🚀 Deploying Backend with Keep-Alive Service to Azure" -ForegroundColor Blue
Write-Host "==================================================" -ForegroundColor Blue
Write-Host ""

# Configuration
$DOCKER_IMAGE = "scale112/pavan-client-backend"
$TAG = "latest"
$AZURE_APP_NAME = "pavan-client-backend-bxgdaqhvarfdeuhe"

Write-Host "Step 1: Building Docker Image" -ForegroundColor Cyan
Write-Host "Building $DOCKER_IMAGE:$TAG..."
docker build -t "${DOCKER_IMAGE}:${TAG}" .

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image built successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to build Docker image" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 2: Logging into Docker Hub" -ForegroundColor Cyan
docker login

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Logged into Docker Hub" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to login to Docker Hub" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Step 3: Pushing Docker Image" -ForegroundColor Cyan
Write-Host "Pushing $DOCKER_IMAGE:$TAG..."
docker push "${DOCKER_IMAGE}:${TAG}"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Docker image pushed successfully" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to push Docker image" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "✅ Deployment Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "==================================================" -ForegroundColor Blue
Write-Host "IMPORTANT NEXT STEPS:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. Go to Azure Portal: https://portal.azure.com"
Write-Host "2. Navigate to: $AZURE_APP_NAME"
Write-Host "3. Go to: Deployment Center"
Write-Host "4. Verify image is set to: ${DOCKER_IMAGE}:${TAG}"
Write-Host "5. Click 'Restart' in Overview"
Write-Host "6. Wait 2-3 minutes for container to start"
Write-Host ""
Write-Host "7. CRITICAL: Enable 'Always On'" -ForegroundColor Yellow
Write-Host "   - Configuration → General settings → Always On = On"
Write-Host "   - (Requires Basic tier or higher)"
Write-Host ""
Write-Host "8. Verify deployment:"
Write-Host "   curl https://${AZURE_APP_NAME}.canadacentral-01.azurewebsites.net/health"
Write-Host "   curl https://${AZURE_APP_NAME}.canadacentral-01.azurewebsites.net/health/keep-alive"
Write-Host ""
Write-Host "==================================================" -ForegroundColor Blue
Write-Host ""
Write-Host "📋 See AUTO_POSTING_FIX_GUIDE.md for complete instructions" -ForegroundColor Cyan
