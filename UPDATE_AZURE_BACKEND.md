# 🚀 Update Azure Backend with Fixed Automation

## Current Issue
Automation posts are only created when you log in because the Azure backend is running an **old version** without the automation scheduler fixes.

## Solution: Deploy New Docker Image to Azure

### Step 1: Login to Azure Portal
1. Go to: https://portal.azure.com
2. Navigate to your App Service: **pavan-client-backend**
3. URL: `pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net`

### Step 2: Update Container Settings
1. In the left menu, click **Deployment Center**
2. Under **Registry settings**:
   - Registry source: **Docker Hub**
   - Access: **Public**
   - Image: `scale112/pavan-client-backend:latest`
   - Tag: `latest`
3. Click **Save**

### Step 3: Restart the App Service
1. Go to **Overview** in the left menu
2. Click **Restart** at the top
3. Wait 2-3 minutes for the container to start

### Step 4: Verify Deployment
1. Check if the backend is running:
   ```
   https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
   ```
   Should return: `{"status":"ok"}`

2. Check logs to verify automation scheduler started:
   - In Azure Portal, go to **Log stream** (left menu)
   - Look for: `[AutomationScheduler] 🚀 Initializing all automations from Supabase...`
   - Look for: `[AutomationScheduler] ⏰ Starting missed post checker`

### Step 5: Test Automation
1. Set up a test automation with frequency "test30s" (every 30 seconds)
2. Wait 30 seconds WITHOUT logging in
3. Check if post is created automatically
4. Check Azure logs for: `[AutomationScheduler] ⏰ CRON TRIGGERED`

---

## Alternative: Redeploy from Source (If Docker Update Doesn't Work)

If the Docker image update doesn't work, you can redeploy from source:

### 1. Ensure Azure has latest code
The code was already pushed to GitHub in the previous step.

### 2. Configure Azure for GitHub Deployment
1. In Azure Portal → **Deployment Center**
2. Source: **GitHub**
3. Authenticate and select:
   - Organization: `pavanreddy950`
   - Repository: `gmb-boost-pro`
   - Branch: `main`
4. Click **Save**

### 3. Azure will automatically build and deploy
- Azure will detect the `Dockerfile` in `/server` folder
- It will build and deploy automatically
- Check **Deployment logs** to monitor progress

---

## Why This Fixes the Issue

The new Docker image includes:
1. ✅ Fixed automation scheduler with proper cron expressions
2. ✅ Missed post checker that runs every 2 minutes
3. ✅ Better interval checking for "alternative" frequency
4. ✅ Duplicate post prevention

Once Azure is running the new version:
- ✅ Automation will run 24/7 on Azure servers
- ✅ Posts will be created at scheduled times even when your laptop is off
- ✅ Missed posts will be caught within 2 minutes

---

## Monitoring After Update

### Check Automation Logs in Azure
1. Go to Azure Portal → Your App Service
2. Click **Log stream** in left menu
3. Watch for these messages every 2 minutes:
   ```
   [AutomationScheduler] 🔍 Running periodic check for missed posts...
   [AutomationScheduler] 📅 Checking X locations for missed posts
   ```

### When a Post is Created
You should see:
```
[AutomationScheduler] ⏰ CRON TRIGGERED - Running scheduled post
[AutomationScheduler] 🤖 Creating automated post for location
[AutomationScheduler] ✅ Successfully created post
```

---

## Quick Command Reference

### Check if Azure Backend is Running
```bash
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
```

### View Latest Logs (Azure CLI - Optional)
```bash
az webapp log tail --name pavan-client-backend --resource-group <your-resource-group>
```

---

## Important Notes

1. **Environment Variables**: Make sure Azure has all required environment variables set:
   - Firebase credentials
   - Supabase credentials
   - Google OAuth credentials
   - OpenAI API key (hardcoded in code, but verify)

2. **Always On**: Ensure "Always On" is enabled in Azure App Service:
   - Go to **Configuration** → **General settings**
   - Set **Always On** to **On**
   - This prevents Azure from sleeping when idle

3. **Timezone**: The automation scheduler uses `America/New_York` timezone by default. Adjust if needed in the automation settings.

---

## Need Help?

If automation still doesn't work after updating:
1. Check Azure logs for errors
2. Verify Supabase connection is working
3. Ensure Google OAuth tokens are valid
4. Check that automation is enabled in the settings

**Azure Backend URL**: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
