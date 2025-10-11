# PowerShell script to update Azure Web App with latest Docker image

$webAppName = "pavan-client-backend-bxgdaqhvarfdeuhe"
$resourceGroup = "DefaultResourceGroup-CAC"  # Update this if different
$dockerImage = "scale112/pavan-client-backend:v10-syntax-fix"

Write-Host "🔄 Updating Azure Web App with latest Docker image..." -ForegroundColor Cyan

# Check if Azure CLI is installed
if (!(Get-Command az -ErrorAction SilentlyContinue)) {
    Write-Host "❌ Azure CLI not found. Please install it from: https://aka.ms/installazurecliwindows" -ForegroundColor Red
    Write-Host ""
    Write-Host "Alternative: Update via Azure Portal:" -ForegroundColor Yellow
    Write-Host "1. Go to https://portal.azure.com" -ForegroundColor Yellow
    Write-Host "2. Search for: $webAppName" -ForegroundColor Yellow
    Write-Host "3. Go to: Deployment Center" -ForegroundColor Yellow
    Write-Host "4. Change image tag to: v10-syntax-fix" -ForegroundColor Yellow
    Write-Host "5. Click Save and wait 2-3 minutes for restart" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Azure CLI found" -ForegroundColor Green

# Login check
Write-Host "🔐 Checking Azure login status..."
$loginStatus = az account show 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️ Not logged in to Azure. Logging in..." -ForegroundColor Yellow
    az login
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Login failed" -ForegroundColor Red
        exit 1
    }
}

Write-Host "✅ Logged in to Azure" -ForegroundColor Green

# Update container settings
Write-Host "📦 Updating container image to: $dockerImage"
az webapp config container set `
    --name $webAppName `
    --resource-group $resourceGroup `
    --docker-custom-image-name $dockerImage `
    --docker-registry-server-url "https://index.docker.io"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Container image updated successfully" -ForegroundColor Green

    # Restart web app
    Write-Host "🔄 Restarting web app..."
    az webapp restart --name $webAppName --resource-group $resourceGroup

    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Web app restarted successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "⏱️ Please wait 2-3 minutes for the new container to start" -ForegroundColor Cyan
        Write-Host "🌐 Test at: https://$webAppName.canadacentral-01.azurewebsites.net/health" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Restart failed" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Failed to update container image" -ForegroundColor Red
}
