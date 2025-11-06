# Backend Health Check Script
# This script checks if your Azure backend is running

Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Backend Health Check" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""

$backendUrl = "https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net"

Write-Host "Testing Backend: $backendUrl" -ForegroundColor Yellow
Write-Host ""

# Test 1: Health Endpoint
Write-Host "1. Testing /health endpoint..." -ForegroundColor White
try {
    $response = Invoke-WebRequest -Uri "$backendUrl/health" -TimeoutSec 10 -ErrorAction Stop
    if ($response.StatusCode -eq 200) {
        Write-Host "   SUCCESS: Backend is running!" -ForegroundColor Green
        Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
    }
} catch {
    Write-Host "   FAILED: Backend is DOWN!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Message -like "*503*") {
        Write-Host ""
        Write-Host "   The backend returned 503 Service Unavailable" -ForegroundColor Yellow
        Write-Host "   This means the Azure App Service is not running." -ForegroundColor Yellow
    }
}

Write-Host ""

# Test 2: CORS Preflight
Write-Host "2. Testing CORS configuration..." -ForegroundColor White
try {
    $headers = @{
        "Origin" = "https://www.app.lobaiseo.com"
        "Access-Control-Request-Method" = "GET"
    }
    $response = Invoke-WebRequest -Uri "$backendUrl/api/payment/subscription/status" -Method Options -Headers $headers -TimeoutSec 10 -ErrorAction Stop
    
    $corsHeader = $response.Headers["Access-Control-Allow-Origin"]
    if ($corsHeader) {
        Write-Host "   CORS configured correctly" -ForegroundColor Green
        Write-Host "   Allowed Origin: $corsHeader" -ForegroundColor Gray
    } else {
        Write-Host "   CORS headers not found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   CORS check failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "======================================" -ForegroundColor Cyan
Write-Host "  Recommended Actions" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If backend is DOWN:" -ForegroundColor Yellow
Write-Host "1. Go to: https://portal.azure.com" -ForegroundColor White
Write-Host "2. Navigate to: App Services" -ForegroundColor White
Write-Host "3. Select pavan-client-backend-bxgdaqhvarfdeuhe" -ForegroundColor White
Write-Host "4. Click Restart button" -ForegroundColor White
Write-Host "5. Wait 2-3 minutes and run this script again" -ForegroundColor White
Write-Host ""
Write-Host "If backend keeps failing:" -ForegroundColor Yellow
Write-Host "1. Check Log stream in Azure Portal" -ForegroundColor White
Write-Host "2. Verify environment variables are set" -ForegroundColor White
Write-Host "3. Check deployment logs" -ForegroundColor White
Write-Host ""
