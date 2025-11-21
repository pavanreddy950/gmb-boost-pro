@echo off
echo ========================================
echo AZURE DEPLOYMENT - UPDATE STEPS
echo ========================================
echo.
echo Docker image is ready: scale112/pavan-client-backend:latest
echo.
echo NEXT STEPS TO UPDATE AZURE:
echo.
echo 1. Go to Azure Portal: https://portal.azure.com
echo    ^(Login if needed^)
echo.
echo 2. Find your App Service:
echo    - Search for: pavan-client-backend-bxgdaqhvarfdeuhe
echo    - Click on it
echo.
echo 3. Update Deployment Center:
echo    - Click "Deployment Center" in left sidebar
echo    - Verify these settings:
echo      * Registry: Docker Hub
echo      * Image and tag: scale112/pavan-client-backend:latest
echo    - Click "Save" at the top
echo.
echo 4. Restart the App Service:
echo    - Click "Overview" in left sidebar
echo    - Click "Restart" button at the top
echo    - Wait 2-3 minutes
echo.
echo 5. Check Logs:
echo    - Click "Log stream" in left sidebar
echo    - Look for these messages:
echo      * [AutomationScheduler] Loaded X automation^(s^) from Supabase
echo      * [AutomationScheduler] Cron job registered. Total active jobs: X
echo.
echo    Expected: "Total active jobs: 2"
echo.
echo 6. IMPORTANT - Enable "Always On":
echo    - Click "Configuration" in left sidebar
echo    - Click "General settings" tab
echo    - Set "Always On" to "On"
echo    - Click "Save" at the top
echo.
echo ========================================
echo WHAT CHANGED:
echo ========================================
echo.
echo Fixed Issues:
echo  - JSON parsing bug in automation scheduler
echo  - Location ID now properly read from Supabase
echo  - Keep-alive service to prevent Azure sleep
echo  - Diagnostic endpoints for troubleshooting
echo.
echo New Features:
echo  - /api/automation/debug/active-jobs
echo  - /api/automation/debug/settings-cache
echo  - /api/automation/debug/scheduler-status
echo  - /health/keep-alive endpoint
echo.
echo ========================================
echo.
pause
