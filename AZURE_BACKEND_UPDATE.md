# Azure Backend Not Updating - Fix

## The Problem
Azure App Service is NOT automatically pulling the latest Docker image when you restart.

## Solution: Force Azure to Pull Latest Image

### Option 1: Azure Portal - Webhook
1. Go to: https://portal.azure.com
2. Navigate to: `pavan-client-backend` App Service
3. Go to: **Deployment Center**
4. Click: **"Sync"** or **"Webhook"** button
5. This forces Azure to pull latest image from Docker Hub

### Option 2: Azure CLI (Recommended)
```bash
# Login
az login

# Restart with latest image
az webapp restart --name pavan-client-backend --resource-group <your-resource-group>

# OR force container update
az webapp config container set --name pavan-client-backend --resource-group <your-resource-group> --docker-custom-image-name scale112/lobaiseo-backend:latest
```

### Option 3: Update Container Settings Manually
1. Go to: Azure Portal → `pavan-client-backend`
2. Go to: **Configuration** → **Application settings**
3. Find: `DOCKER_REGISTRY_SERVER_URL`
4. Add a dummy change (add space) and save
5. Then remove it and save again
6. This triggers a redeploy

### Option 4: Environment Variable Trigger
1. Go to: **Configuration** → **Application settings**
2. Add new setting: `FORCE_UPDATE=1`
3. Click **Save**
4. Click **Restart**
5. Check if `/health` shows new timestamp

## Verify New Image is Running

After updating, check:
```bash
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
```

Look for updated timestamp.

## Current Issue
The auto-post endpoint needs the new code that:
1. Gets userId from request header
2. Fetches token from Firebase for that userId
3. Uses token to create post

If still using old code, it won't work!
