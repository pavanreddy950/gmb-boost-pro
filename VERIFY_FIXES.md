# Quick Verification Guide

## Step 1: Deploy the Fixes

### Option A: Deploy to Azure (Production)
```bash
# Navigate to server directory
cd server

# Build and push Docker image
docker build -t scale112/pavan-client-backend:latest .
docker push scale112/pavan-client-backend:latest

# The Azure container will automatically restart with the new image
```

### Option B: Test Locally
```bash
# Start the backend server
cd server
npm run dev

# In another terminal, start the frontend
npm run dev
```

---

## Step 2: Verify Cron Jobs Are Running

### Check Active Jobs
```bash
# Make a GET request to check active jobs
curl http://localhost:5000/api/automation/debug/active-jobs

# OR if deployed to Azure:
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/active-jobs
```

**Expected Response:**
```json
{
  "success": true,
  "totalActiveJobs": 1,
  "activeJobs": [
    {
      "locationId": "your-location-id",
      "businessName": "Your Business Name",
      "frequency": "daily",
      "schedule": "09:00",
      "lastRun": "2025-12-25T03:30:00.000Z",
      "isRunning": true,
      "timezone": "Asia/Kolkata"
    }
  ],
  "reviewMonitors": 1,
  "message": "1 cron job(s) are currently active"
}
```

✅ **If you see jobs**: Cron is registered correctly!
❌ **If totalActiveJobs is 0**: Follow Step 3 to reload automations

---

## Step 3: Force Reload Automations (If Needed)

```bash
# Force reload all automations from database
curl -X POST http://localhost:5000/api/automation/debug/reload-automations

# OR for Azure:
curl -X POST https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/reload-automations
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Automations reloaded! 1 cron job(s) now active.",
  "activeJobs": 1,
  "reviewMonitors": 1
}
```

---

## Step 4: Test CTA Button Fix RIGHT NOW

### Trigger a Test Post Immediately
```bash
# Replace :locationId with your actual location ID
curl -X POST http://localhost:5000/api/automation/test-post-now/YOUR_LOCATION_ID \
  -H "Content-Type: application/json" \
  -H "x-user-id: YOUR_USER_ID" \
  -d '{
    "businessName": "Test Business",
    "category": "Restaurant",
    "keywords": "food, quality, service",
    "city": "Jalandhar",
    "region": "Punjab",
    "country": "India",
    "button": {
      "enabled": false,
      "type": "none"
    }
  }'
```

**What to Check:**
1. Look at the server logs - you should see:
   ```
   [AutomationScheduler] 🔘 CTA BUTTON GENERATION
   [AutomationScheduler] 🔧 OVERRIDE: Auto-posting requires CTA - forcing CALL button
   [AutomationScheduler] 🎯 Smart-selected button type: call_now (always CALL for auto-posting)
   [AutomationScheduler] ✅ Generated CALL CTA: { actionType: 'CALL' }
   [AutomationScheduler] 📞 Phone number will be automatically used from business profile
   ```

2. Check your Google Business Profile - the post should have a CALL button

---

## Step 5: Monitor 9 AM Auto-Post

### What to Do:
1. Keep the backend server running
2. At 9:00 AM IST, check the server logs for this output:

```
[AutomationScheduler] ========================================
[AutomationScheduler] ⏰ CRON JOB TRIGGERED!
[AutomationScheduler] 📍 Location: 12345...
[AutomationScheduler] 🏢 Business: Your Business Name
[AutomationScheduler] 🕐 Trigger time (IST): 12/25/2025, 9:00:00 AM
[AutomationScheduler] 🕐 Trigger time (UTC): 2025-12-25T03:30:00.000Z
[AutomationScheduler] 📅 Frequency: daily
[AutomationScheduler] ⏰ Schedule: 09:00
[AutomationScheduler] 🌍 Timezone: Asia/Kolkata
[AutomationScheduler] 📝 Cron Expression: 0 9 * * *
[AutomationScheduler] ========================================
[AutomationScheduler] ▶️ Executing createAutomatedPost now...
```

### If You See This Log:
✅ **Cron is working!** The job triggered at the right time.

### If You DON'T See This Log at 9 AM:
❌ **Cron didn't trigger**. Possible issues:
- Server wasn't running
- Automation wasn't registered (check Step 2)
- Wrong timezone configuration

---

## Step 6: Verify Settings in Database

### Check Automation Settings Cache
```bash
curl http://localhost:5000/api/automation/debug/settings-cache

# OR for Azure:
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/automation/debug/settings-cache
```

**Expected Response:**
```json
{
  "success": true,
  "totalLocations": 1,
  "locationsWithAutoPosting": 1,
  "locationsWithAutoReply": 1,
  "settings": [
    {
      "locationId": "...",
      "businessName": "Your Business",
      "autoPostingEnabled": true,
      "autoReplyEnabled": true,
      "schedule": "09:00",
      "frequency": "daily",
      "lastRun": "2025-12-25T03:30:00.000Z"
    }
  ]
}
```

✅ **If autoPostingEnabled is true**: Settings are saved correctly!

---

## Troubleshooting

### Problem: No cron jobs active
**Solution:**
1. Check if automation is enabled in frontend Settings page
2. Force reload: `POST /api/automation/debug/reload-automations`
3. Check server logs for "✅ [AUTOMATION] Automations started successfully"
4. Restart backend server

### Problem: Cron triggers but post creation fails
**Solution:**
1. Check server logs for error messages
2. Verify Google Business Profile connection is active
3. Ensure user has valid token in Supabase
4. Check subscription/trial is valid

### Problem: Post created but still no CTA button
**Solution:**
1. **This should be FIXED now** - check server logs for CTA generation
2. Look for "✅ Generated CALL CTA: { actionType: 'CALL' }"
3. Verify the post data includes "callToAction" before API call
4. Check if Google Business Profile has a phone number set

---

## Success Criteria

✅ **Fix 1 (CTA Button)**: Test post has CALL button even with disabled button config
✅ **Fix 2 (9 AM Posting)**: Server logs show "⏰ CRON JOB TRIGGERED!" at 9:00 AM IST
✅ **Fix 3 (Visibility)**: Clear diagnostic logs make it easy to see what's happening

---

## Need Help?

If issues persist:
1. Share the server logs (especially around 9 AM IST)
2. Share the output of `/api/automation/debug/active-jobs`
3. Share the output of `/api/automation/debug/settings-cache`
4. Test with `/api/automation/test-post-now/:locationId` and share logs

All the detailed technical information is in `AUTO_POSTING_FIX_SUMMARY.md`
