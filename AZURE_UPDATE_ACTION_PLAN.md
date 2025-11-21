# 🚨 CRITICAL: Azure Update Required

## Current Situation

✅ **Code is correct** - The automation scheduler with all fixes is in `server.js` (line 4123)
✅ **Docker image pushed** - `scale112/pavan-client-backend:latest` contains the fixes
❌ **Azure hasn't updated** - Azure is still running an OLD version from 7:07 AM

### Evidence:
- Azure logs show **NO `[AutomationScheduler]` messages**
- The server should log these on startup (5 seconds after boot):
  ```
  🤖 [AUTOMATION] Restarting all automations after server startup...
  ✅ [AUTOMATION] All automations loaded from Supabase and restarted!
  ```

## 🎯 Required Action: Force Azure to Pull Latest Image

### Option 1: Restart with Image Pull (Easiest)

In Azure Portal:

1. **Stop the App Service**:
   - Go to Overview
   - Click **"Stop"** button
   - Wait 30 seconds

2. **Pull Latest Image**:
   - Go to **"Deployment Center"**
   - Click **"Sync"** or **"Redeploy"** button (if available)
   - OR change tag to `latest2`, save, then back to `latest`, save

3. **Start the App Service**:
   - Go back to Overview
   - Click **"Start"** button

4. **Verify in Log Stream**:
   - Go to **"Log stream"**
   - Wait for container to start
   - Look for these messages:
     ```
     🤖 [AUTOMATION] Restarting all automations...
     ✅ [AUTOMATION] All automations loaded from Supabase and restarted!
     [AutomationScheduler] 🚀 Initializing all automations from Supabase...
     [AutomationScheduler] ⏰ Starting missed post checker (every 2 minutes)
     ```

### Option 2: Azure CLI Command (Fastest)

If you have Azure CLI installed:

```powershell
# Force pull latest image and restart
az webapp restart --name pavan-client-backend --resource-group <your-resource-group>

# Force a full deployment
az webapp deployment container config --name pavan-client-backend --resource-group <your-resource-group> --enable-cd true
```

### Option 3: Redeploy Container (Most Reliable)

1. In Azure Portal → **Deployment Center**
2. **Container Settings** section
3. Change these values:
   - **Image name**: `scale112/pavan-client-backend`  
   - **Tag**: Change from `latest` to a specific tag like `v2` 
   - Click **Save**
   - Wait 2 minutes
4. Change back:
   - **Tag**: Change back to `latest`
   - Click **Save**
5. This forces Azure to pull the image fresh

---

## ✅ How to Verify It Worked

### 1. Check Health Endpoint
Visit: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

Should return: `{"status":"ok","timestamp":"...","uptime":"..."}`

### 2. Check Log Stream for Automation Messages

You should see **within 10 seconds of container start**:

```
🔄 [TOKEN REFRESH] Starting proactive token refresh service...
✅ [TOKEN REFRESH] Token refresh service started!
🤖 [AUTOMATION] Restarting all automations after server startup...
[AutomationScheduler] 📥 Loading automation settings from Supabase...
[AutomationScheduler] ✅ Loaded X automation(s) from Supabase
[AutomationScheduler] 🚀 Initializing all automations from Supabase...
[AutomationScheduler] ✅ Initialized X posting schedules
[AutomationScheduler] ⏰ Starting missed post checker (every 2 minutes)
✅ [AUTOMATION] All automations loaded from Supabase and restarted!
```

### 3. Check for Periodic Automation Checks

Every 2 minutes, you should see:
```
[AutomationScheduler] 🔍 Running periodic check for missed posts...
[AutomationScheduler] 📅 Checking X locations for missed posts
```

### 4. Test Automation Without Login

1. Set up a test automation with `test30s` frequency (every 30 seconds)
2. Close your laptop
3. Wait 30-60 seconds
4. Check Azure logs - you should see post creation logs
5. Check your Google Business Profile - post should be there

---

## 🐛 Additional Issue: Payment Gateway 500 Error

Your browser console shows:
```
Failed to load resource: the server responded with a status of 500
/api/payment/subscription/create-with-mandate
```

This means the **payment subscription creation is failing on the backend**.

### Possible Causes:
1. **Razorpay API credentials not set** in Azure environment variables
2. **Supabase connection failing** (can't save subscription)
3. **Missing environment variables** in Azure

### Check Azure Environment Variables:

In Azure Portal → **Configuration** → **Application settings**:

Verify these are set:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- All Firebase credentials
- `NODE_ENV=production`
- `RUN_MODE=AZURE`

If any are missing, the backend will crash or fail silently.

---

## 🔧 Quick Checklist

- [ ] Azure has pulled latest Docker image (`scale112/pavan-client-backend:latest`)
- [ ] Azure logs show `[AutomationScheduler]` messages on startup
- [ ] Azure logs show periodic check messages every 2 minutes
- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] **Always On** is enabled (Configuration → General settings)
- [ ] All environment variables are set in Azure
- [ ] Payment gateway works (no 500 errors)
- [ ] Test automation runs without you being logged in

---

## 📞 If Automation Still Doesn't Work After Update

1. **Check Supabase** - Verify automation settings are saved:
   - Go to Supabase dashboard
   - Check `automation_settings` table
   - Verify `enabled: true` and correct `location_id`

2. **Check Google OAuth Tokens**:
   - Verify tokens are in Supabase `oauth_tokens` table
   - Check token hasn't expired
   - Re-connect Google Business Profile if needed

3. **Check Azure Logs for Errors**:
   - Look for `❌` or `ERROR` messages
   - Check if automation scheduler crashes on startup

---

## 🚀 Bottom Line

**Azure is using an old Docker image.** You need to force Azure to pull the latest image by:
1. Stopping the app
2. Redeploying/syncing the container
3. Starting the app
4. Verifying logs show automation scheduler messages

Once Azure has the latest image, automation will work 24/7 even when your laptop is off.
