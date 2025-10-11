# Manual Azure Portal Deployment Steps

## Summary of Fixes Applied

✅ **Fixed `.dockerignore`** - Now includes `.env.azure` file
✅ **Improved `config.js`** - Better error handling for missing config files
✅ **Updated `Dockerfile`** - Properly includes environment configuration
✅ **Built new Docker image** - Image ID: `38b346708b39`
✅ **Pushed to Docker Hub** - `scale112/pavan-client-backend:latest`

## Current Status

The new Docker image has been successfully built and pushed to Docker Hub. However, Azure App Service is still running the old image and showing "Application Error". You need to trigger Azure to pull and deploy the new image.

## Step-by-Step Deployment Instructions

### Step 1: Access Azure Portal

1. Go to https://portal.azure.com
2. Sign in with your Azure account
3. Search for "pavan-client-backend-bxgdaqhvarfdeuhe" in the top search bar
4. Click on the App Service

### Step 2: Restart the App Service (Quick Method)

**This will trigger Azure to pull the latest Docker image:**

1. In the App Service overview page, click **"Restart"** button at the top
2. Confirm the restart
3. Wait 2-3 minutes for Azure to:
   - Stop the current container
   - Pull the latest `scale112/pavan-client-backend:latest` image from Docker Hub
   - Start the new container

### Step 3: Verify Deployment

After 2-3 minutes, test the health endpoint:

```bash
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
```

**Expected response:**
```json
{"status":"ok","timestamp":"2025-10-11T..."}
```

**If still showing "Application Error"**, proceed to Step 4.

### Step 4: Check and Configure Environment Variables (If Needed)

The Docker image includes `.env.azure` file with all required configuration. However, if Azure is overriding these or the app still fails, you may need to set environment variables in Azure:

1. In App Service, go to **Settings** → **Configuration**
2. Click **"+ New application setting"** for each variable below
3. Click **Save** at the top
4. Click **Continue** to confirm restart

**Required Environment Variables:**

| Name | Value |
|------|-------|
| `NODE_ENV` | `production` |
| `RUN_MODE` | `AZURE` |
| `PORT` | `5000` |
| `GOOGLE_CLIENT_ID` | `52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | `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` |
| `FRONTEND_URL` | `https://www.app.lobaiseo.com` |
| `BACKEND_URL` | `https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net` |
| `GOOGLE_REDIRECT_URI` | `https://www.app.lobaiseo.com/auth/google/callback` |
| `HARDCODED_ACCOUNT_ID` | `106433552101751461082` |

**Database Variables (from server/.env.azure):**

| Name | Value |
|------|-------|
| `SUPABASE_URL` | `https://atxfghdzuokkggexkrnz.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Copy from `server/.env.azure` file |
| `TOKEN_ENCRYPTION_KEY` | Copy from `server/.env.azure` file |

**Payment Variables:**

| Name | Value |
|------|-------|
| `RAZORPAY_KEY_ID` | `rzp_live_RFSzT9EvJ2cwJI` |
| `RAZORPAY_KEY_SECRET` | Copy from `server/.env.azure` file |
| `RAZORPAY_WEBHOOK_SECRET` | `gmb_boost_pro_webhook_secret_2024` |

**AI Variables:**

| Name | Value |
|------|-------|
| `AZURE_OPENAI_ENDPOINT` | `https://agentplus.openai.azure.com/` |
| `AZURE_OPENAI_API_KEY` | Copy from `server/.env.azure` file |
| `AZURE_OPENAI_DEPLOYMENT` | `gpt-4o` |
| `AZURE_OPENAI_API_VERSION` | `2024-02-15-preview` |

**Firebase Variables:**

| Name | Value |
|------|-------|
| `FIREBASE_PROJECT_ID` | `gbp-467810-a56e2` |

### Step 5: Check Application Logs

1. In App Service, go to **Monitoring** → **Log stream**
2. Wait for logs to appear
3. Look for these success messages:
   - `✅ Loaded configuration from .env.azure`
   - `[SERVER] Starting with allowed origins:`
   - `[CONFIG] CORS Origins configured:`
   - `🚀 Server running on port 5000`

**Common error messages and fixes:**

| Error Message | Solution |
|---------------|----------|
| `Missing required environment variables` | Set environment variables in Step 4 |
| `Could not load .env.azure` | Environment variables should be set in Azure Portal |
| `ENOENT: no such file` | Check if required files are in Docker image |
| `Port 5000 already in use` | Azure port conflict - restart the app |

### Step 6: Force Pull Latest Image (If Restart Doesn't Work)

If simple restart doesn't pull the new image:

1. Go to **Deployment** → **Deployment Center**
2. Check the current Docker configuration:
   - **Registry source**: Docker Hub
   - **Image**: `scale112/pavan-client-backend`
   - **Tag**: `latest`
3. Click **"Sync"** or **"Restart"** to force a new pull
4. Monitor the **Logs** tab to see pull progress

### Step 7: Test the Deployment

Run the test script from your local machine:

```bash
cd server
bash test-deployment.sh
```

Or test manually:

1. **Health Check:**
   ```bash
   curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
   ```

2. **CORS Test:**
   ```bash
   curl -X OPTIONS https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/payment/subscription/status \
     -H "Origin: https://www.app.lobaiseo.com" \
     -H "Access-Control-Request-Method: GET" \
     -I
   ```

   Should show: `Access-Control-Allow-Origin: https://www.app.lobaiseo.com`

3. **Frontend Test:**
   - Go to https://www.app.lobaiseo.com
   - Login with your account
   - Go to Settings → Connections
   - Click "Connect Google Business Profile"
   - Should open Google OAuth flow (no CORS errors)

## Troubleshooting

### Issue: "Application Error" persists after restart

**Possible causes:**
1. New image not pulled - wait 5 minutes and try again
2. Environment variables missing - add them in Azure Portal
3. Container failing to start - check logs in Log Stream

**Solutions:**
1. Wait 5 minutes and refresh
2. Check Log Stream for specific error messages
3. Set environment variables manually (Step 4)
4. Try "Stop" → wait 1 minute → "Start"

### Issue: CORS errors still appearing in frontend

**Possible causes:**
1. Old container still running
2. CDN/browser caching old responses
3. CORS configuration not applied

**Solutions:**
1. Hard refresh in browser (Ctrl+F5)
2. Clear browser cache
3. Verify backend is returning correct CORS headers (Step 7, test 2)
4. Check allowed origins in logs

### Issue: "Service Unavailable" or 503 errors

**Possible causes:**
1. Container starting up (normal for 1-2 minutes)
2. Container crashed due to missing dependencies
3. Health check failing

**Solutions:**
1. Wait 2-5 minutes for full startup
2. Check logs for crash errors
3. Verify all environment variables are set

## Quick Verification Checklist

After deployment, verify these items:

- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] CORS headers include `Access-Control-Allow-Origin: https://www.app.lobaiseo.com`
- [ ] Frontend can connect to backend without CORS errors
- [ ] Google Business Profile connection works
- [ ] No "Application Error" messages
- [ ] Logs show successful startup messages

## Next Steps After Successful Deployment

1. Test the full Google Business Profile connection flow
2. Verify all API endpoints work correctly
3. Monitor logs for any runtime errors
4. Set up continuous deployment (optional) to automatically deploy on Docker Hub updates

## Support Resources

- **Azure Portal**: https://portal.azure.com
- **App Service**: https://portal.azure.com/#@/resource/subscriptions/.../resourceGroups/.../providers/Microsoft.Web/sites/pavan-client-backend-bxgdaqhvarfdeuhe
- **Docker Hub Image**: https://hub.docker.com/r/scale112/pavan-client-backend
- **Frontend**: https://www.app.lobaiseo.com
- **Backend Health Check**: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

## What We Fixed

The root cause of the CORS and connection errors was:

1. **Missing `.env.azure` in Docker image** - The `.dockerignore` was excluding it
2. **Azure not pulling latest image** - Manual restart required
3. **No graceful fallback** - App crashed instead of using production defaults

All these issues have been resolved in the new Docker image. You just need to trigger Azure to deploy it by following the steps above.
