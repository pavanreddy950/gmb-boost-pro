# Azure App Service - Restart to Pull Latest Docker Image

## The Issue
After pushing a new Docker image to Docker Hub, Azure App Service needs to be restarted to pull and use the latest image.

## Solution: Restart Azure App Service

### Option 1: Azure Portal (Recommended)
1. Go to https://portal.azure.com
2. Navigate to your App Service: `pavan-client-backend`
3. Click **"Restart"** button at the top
4. Wait 1-2 minutes for restart to complete
5. Verify at: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

### Option 2: Azure CLI
```bash
# Login to Azure
az login

# Restart the app service
az webapp restart --name pavan-client-backend --resource-group <your-resource-group>
```

### Option 3: Force Pull Latest Image
If restart doesn't pull the latest image, you may need to update the container settings:

1. Go to Azure Portal → Your App Service
2. Go to **"Deployment Center"**
3. Click **"Sync"** or **"Redeploy"** to force pull latest image

## Verify Deployment
After restart, check:

```bash
# Check health
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

# Check config (verify it shows latest settings)
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/config
```

## Latest Docker Image
- **Image**: scale112/lobaiseo-backend:latest
- **Pushed**: Just now (October 4, 2025)
- **Contains**:
  - ✅ Fixed null storedTokens bug
  - ✅ Improved OAuth flow
  - ✅ serviceAccountKey.json for Firestore
  - ✅ AZURE mode configuration

## What Changed
- Fixed critical bug where `storedTokens` could be null during token refresh
- Added dual OAuth completion detection (postMessage + sessionStorage)
- Improved error handling and COOP restrictions

---

**After restarting, test the Google Business Profile connection at:**
https://www.app.lobaiseo.com/settings (Connections tab)
