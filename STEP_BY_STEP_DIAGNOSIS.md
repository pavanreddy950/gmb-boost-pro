# 🔍 STEP-BY-STEP DIAGNOSIS & FIX GUIDE

## ✅ YOUR "ALWAYS ON" IS ALREADY ENABLED

Good news! I can see "Always On" is turned on in your Azure screenshot. So the server doesn't sleep - that's not the issue.

## 🔴 THE REAL ISSUE

**Auto-posting doesn't work because NO CRON JOBS ARE RUNNING**

Even though:
- ✅ Server is awake (Always On enabled)
- ✅ Code is correct
- ✅ Automation scheduler is initialized

The problem is likely:
- ❌ No automation settings in Supabase database
- ❌ Cron jobs were never created
- ❌ Server doesn't reload when you enable automation

---

## 🚀 STEP-BY-STEP DIAGNOSIS (Do This First!)

### Step 1: Check Active Cron Jobs

**Open this URL in your browser** (replace with your backend URL):
```
https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/active-jobs
```

**Expected Response (if working)**:
```json
{
  "success": true,
  "totalActiveJobs": 1,
  "activeJobs": [
    {
      "locationId": "xxxxx",
      "businessName": "My Business",
      "frequency": "daily",
      "schedule": "09:00",
      "isRunning": true
    }
  ],
  "message": "1 cron job(s) are currently active"
}
```

**If you see `"totalActiveJobs": 0`** → **THIS IS THE PROBLEM!**

No cron jobs means automation can't run, no matter what.

---

### Step 2: Check Settings Cache

**Open this URL**:
```
https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/settings-cache
```

**Expected Response (if working)**:
```json
{
  "success": true,
  "totalLocations": 1,
  "locationsWithAutoPosting": 1,
  "settings": [
    {
      "locationId": "xxxxx",
      "businessName": "My Business",
      "autoPostingEnabled": true,
      "schedule": "09:00",
      "frequency": "daily"
    }
  ]
}
```

**If you see `"totalLocations": 0`** → **Settings not loaded from Supabase!**

---

### Step 3: Check Scheduler Status

**Open this URL**:
```
https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/scheduler-status
```

This shows detailed status of the scheduler and all locations.

---

## 🔍 DIAGNOSIS RESULTS

Based on the responses above, you'll see one of these scenarios:

### Scenario A: NO Active Jobs (totalActiveJobs = 0)

**Problem**: Cron jobs were never created

**Possible Causes**:
1. Automation settings not saved to Supabase database
2. Server initialized before settings were saved
3. Settings exist but scheduler didn't pick them up

**Solution**: Force reload automations (see Step-by-Step Fix below)

### Scenario B: NO Settings in Cache (totalLocations = 0)

**Problem**: No automation settings loaded from Supabase

**Possible Causes**:
1. Settings only saved to frontend localStorage, not Supabase
2. Supabase table is empty
3. Connection to Supabase failed

**Solution**: Re-configure automation in UI, then force reload

### Scenario C: Settings Exist BUT No Cron Jobs

**Problem**: Settings loaded but cron jobs not created

**Possible Causes**:
1. `enabled` flag is `false` in database
2. Missing required fields (schedule, frequency)
3. Error during cron job creation

**Solution**: Check Azure logs for errors, fix configuration

---

## ✅ STEP-BY-STEP FIX

### Fix 1: Force Reload Automations

**This will reload everything from Supabase and recreate cron jobs:**

**Method A - Using API (Recommended)**:
```bash
curl -X POST https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/reload-automations
```

**Method B - Using Browser**:
1. Open this URL: `https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/reload-automations`
2. You might need to use a tool like Postman or curl since it's a POST request

**Expected Response**:
```json
{
  "success": true,
  "message": "Automations reloaded! X cron job(s) now active.",
  "activeJobs": 1
}
```

**Then check active-jobs again** to verify cron jobs were created.

---

### Fix 2: Re-Configure Automation in UI

If Force Reload didn't create any jobs, it means settings aren't in Supabase.

**Do this**:
1. Go to your app
2. Navigate to Settings → Automation
3. **DISABLE** auto-posting for your location
4. **Save**
5. **ENABLE** auto-posting again
6. Configure schedule (e.g., 9:00 AM, daily)
7. **Save**

**Then immediately**:
1. Check if settings saved: `https://your-backend/api/automation/debug/settings-cache`
2. Force reload: `POST https://your-backend/api/automation/debug/reload-automations`
3. Verify cron jobs created: `https://your-backend/api/automation/debug/active-jobs`

---

### Fix 3: Check Supabase Database Directly

**Go to Supabase Dashboard**:
1. Open your Supabase project
2. Go to **Table Editor**
3. Find table: `automation_settings`
4. Check if there are rows with `enabled = true`

**If table is empty**:
- Frontend is NOT saving to Supabase
- Need to fix the save flow in the UI

**If table has data but `enabled = false`**:
- Toggle automation off and on again in UI

**If table has data with `enabled = true`**:
- Use Fix 1 to force reload

---

## 🔧 DEPLOY UPDATED CODE

The diagnostic endpoints are NEW, so you need to deploy the updated code:

### Step 1: Deploy to Azure

```powershell
cd server
.\deploy-with-keepalive.ps1
```

Or manually:
```bash
cd server
docker build -t scale112/lobaiseo-backend:latest .
docker push scale112/lobaiseo-backend:latest
```

### Step 2: Update Azure

1. Azure Portal → Your App Service
2. **Overview** → Click **Restart**
3. Wait 2-3 minutes

### Step 3: Verify New Endpoints Work

```bash
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/active-jobs
```

Should return JSON (not 404 error).

---

## 📋 COMPLETE DIAGNOSTIC CHECKLIST

After deploying, run through this checklist:

- [ ] **Check active-jobs endpoint**
  - URL: `/api/automation/debug/active-jobs`
  - Expected: `totalActiveJobs > 0`
  - If 0: No cron jobs running!

- [ ] **Check settings-cache endpoint**
  - URL: `/api/automation/debug/settings-cache`
  - Expected: `totalLocations > 0` and `locationsWithAutoPosting > 0`
  - If 0: Settings not loaded!

- [ ] **Check scheduler-status endpoint**
  - URL: `/api/automation/debug/scheduler-status`
  - Expected: `totalScheduledJobs > 0`
  - Should match number of enabled locations

- [ ] **Check Supabase database**
  - Table: `automation_settings`
  - Should have rows with `enabled = true`

- [ ] **Force reload automations**
  - POST to `/api/automation/debug/reload-automations`
  - Should create cron jobs

- [ ] **Check Azure logs**
  - Look for: `[AutomationScheduler] Scheduling auto-posting for location ...`
  - Should see: `✅ Cron job registered. Total active jobs: X`

- [ ] **Test with test30s frequency**
  - Set frequency to "test30s"
  - Save settings
  - Force reload
  - Wait 30 seconds WITHOUT logging in
  - Check if post was created

---

## 🎯 SUCCESS CRITERIA

**You'll know it's working when**:

1. ✅ `/api/automation/debug/active-jobs` shows `totalActiveJobs > 0`
2. ✅ Azure logs show: `[AutomationScheduler] ⏰ CRON TRIGGERED` at scheduled times
3. ✅ Posts are created WITHOUT you logging in
4. ✅ Missed post checker runs every 2 minutes (see logs)

---

## 🆘 IF STILL NOT WORKING

### Check 1: Azure Logs

Go to: Azure Portal → Your App Service → Log stream

**Look for these on startup**:
```
[AutomationScheduler] 🚀 Initializing all automations from Supabase...
[AutomationScheduler] ✅ Loaded X automation(s) from Supabase
```

**If X = 0**: Supabase has no automation settings!

**Look for cron job creation**:
```
[AutomationScheduler] Scheduling auto-posting for location XXXXX with cron: 0 9 * * *
[AutomationScheduler] ✅ Cron job registered. Total active jobs: 1
```

**If you don't see this**: Cron jobs never created!

### Check 2: Test Endpoint

Try the test-post-now endpoint to verify the post creation works:

```bash
POST https://your-backend/api/automation/test-post-now/YOUR_LOCATION_ID
Body: {
  "businessName": "My Business",
  "category": "Restaurant",
  "keywords": "food, dining, restaurant"
}
```

If this works but scheduled posts don't, it means:
- ✅ Post creation logic works
- ✅ Google API works
- ✅ Tokens work
- ❌ Cron jobs aren't triggering

### Check 3: Timezone Issue

Your cron jobs use timezone `America/New_York` by default.

If you're in India and set schedule for 9:00 AM:
- Your local time: 9:00 AM IST
- Server time (NY): 10:30 PM previous day

**This might cause unexpected timing.**

**Solution**: Check Azure logs to see when cron actually triggers.

---

## 📞 NEXT STEPS

1. **Deploy updated code** (with diagnostic endpoints)
2. **Restart Azure**
3. **Run diagnostic checklist above**
4. **Share results** with me:
   - Response from `/debug/active-jobs`
   - Response from `/debug/settings-cache`
   - Response from `/debug/scheduler-status`
   - Azure logs (startup + cron trigger sections)

Then I can give you the exact fix based on what's actually happening!

---

**Last Updated**: 2025-11-21
**Status**: Diagnostic endpoints added, ready for deployment
