# Fix CORS Error - Azure Deployment

## Problem
Getting this error in production:
```
Access to fetch at 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/auth/google/url'
from origin 'https://www.app.lobaiseo.com' has been blocked by CORS policy:
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## Root Cause
Azure App Service is missing critical environment variables that tell the backend to run in production mode and allow your frontend URL.

## Solution

### Step 1: Update Azure App Service Environment Variables

Go to Azure Portal and set these environment variables:

#### Required Variables (MUST SET THESE)
```bash
NODE_ENV=production
RUN_MODE=AZURE
FRONTEND_URL=https://www.app.lobaiseo.com
BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
```

#### Complete Configuration
For best results, set ALL these variables in Azure Portal:

```bash
# Environment Configuration
NODE_ENV=production
RUN_MODE=AZURE
PORT=5000

# URLs
FRONTEND_URL=https://www.app.lobaiseo.com
BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
GOOGLE_REDIRECT_URI=https://www.app.lobaiseo.com/auth/google/callback

# Google OAuth
GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Google Business Profile
HARDCODED_ACCOUNT_ID=106433552101751461082

# Razorpay (Live Credentials)
RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI
RAZORPAY_KEY_SECRET=7i0iikfS6eO7w4DSLXldCBX5
RAZORPAY_WEBHOOK_SECRET=gmb_boost_pro_webhook_secret_2024

# Azure OpenAI
AZURE_OPENAI_ENDPOINT=https://agentplus.openai.azure.com/
AZURE_OPENAI_API_KEY=1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Supabase Database
SUPABASE_URL=https://atxfghdzuokkggexkrnz.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eGZnaGR6dW9ra2dnZXhrcm56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA2MTkyMCwiZXhwIjoyMDc1NjM3OTIwfQ.iDE6xhKIcJSX-f971efvhZGo0HhWyHbrbmarNN_VUqg
TOKEN_ENCRYPTION_KEY=sLiAOaHkyCpljqnc2WZh85fDVEvKb6g4

# Firebase
FIREBASE_PROJECT_ID=gbp-467810-a56e2
```

### Step 2: How to Set in Azure Portal

1. **Login to Azure Portal**
   - Go to https://portal.azure.com
   - Sign in with your Azure account

2. **Navigate to App Service**
   - Search for "App Services" in the top search bar
   - Click on **pavan-client-backend-bxgdaqhvarfdeuhe**

3. **Open Configuration**
   - In the left sidebar, find **Configuration**
   - Click on **Environment variables** tab

4. **Add Variables**
   - Click **+ New application setting** for each variable
   - Name: Enter the variable name (e.g., `NODE_ENV`)
   - Value: Enter the value (e.g., `production`)
   - Click **OK**

5. **Save Changes**
   - After adding ALL variables, click **Save** at the top
   - Confirm the save operation
   - Click **Restart** to restart the App Service

### Step 3: Using Azure CLI (Alternative)

If you prefer using the command line:

```bash
# Login to Azure
az login

# Set the critical environment variables
az webapp config appsettings set \
  --name pavan-client-backend-bxgdaqhvarfdeuhe \
  --resource-group <your-resource-group> \
  --settings \
    NODE_ENV=production \
    RUN_MODE=AZURE \
    FRONTEND_URL=https://www.app.lobaiseo.com \
    BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net \
    GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com \
    GOOGLE_CLIENT_SECRET=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 \
    GOOGLE_REDIRECT_URI=https://www.app.lobaiseo.com/auth/google/callback \
    HARDCODED_ACCOUNT_ID=106433552101751461082 \
    RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI \
    RAZORPAY_KEY_SECRET=7i0iikfS6eO7w4DSLXldCBX5 \
    AZURE_OPENAI_ENDPOINT=https://agentplus.openai.azure.com/ \
    AZURE_OPENAI_API_KEY=1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia \
    AZURE_OPENAI_DEPLOYMENT=gpt-4o \
    AZURE_OPENAI_API_VERSION=2024-02-15-preview \
    SUPABASE_URL=https://atxfghdzuokkggexkrnz.supabase.co \
    SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImF0eGZnaGR6dW9ra2dnZXhrcm56Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MDA2MTkyMCwiZXhwIjoyMDc1NjM3OTIwfQ.iDE6xhKIcJSX-f971efvhZGo0HhWyHbrbmarNN_VUqg \
    TOKEN_ENCRYPTION_KEY=sLiAOaHkyCpljqnc2WZh85fDVEvKb6g4 \
    FIREBASE_PROJECT_ID=gbp-467810-a56e2

# Restart the app service
az webapp restart \
  --name pavan-client-backend-bxgdaqhvarfdeuhe \
  --resource-group <your-resource-group>
```

### Step 4: Verify the Fix

After restarting, check the logs:

```bash
# View logs in Azure Portal
1. Go to App Service > Log stream
2. Look for these messages:
   - "✅ Loaded configuration from .env.azure"
   - "[CONFIG] Origin 1: https://www.app.lobaiseo.com"
   - "[CORS] ✅ Origin https://www.app.lobaiseo.com is ALLOWED"

# Or test directly
curl -I https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
```

## How This Fixes CORS

When you set `NODE_ENV=production` and `RUN_MODE=AZURE`, the backend's `config.js` will:

1. **Load production configuration** (server/config.js:56-98)
   - Sets production defaults including your frontend URL

2. **Enable Azure origins** (server/config.js:230-236)
   - Adds `https://www.app.lobaiseo.com` to allowed origins
   - Adds `https://delightful-sea-062191a0f.2.azurestaticapps.net` as backup
   - Adds the backend URL itself

3. **Configure CORS middleware** (server/server.js:65-90)
   - Checks incoming origin against allowed list
   - Sends `Access-Control-Allow-Origin` header
   - Allows preflight requests

## Expected Behavior After Fix

### Console Logs You Should See
```
✅ Loaded configuration from .env.azure
[CONFIG] CORS Origins configured: 3 origins
[CONFIG] Origin 1: https://www.app.lobaiseo.com
[CONFIG] Origin 2: https://delightful-sea-062191a0f.2.azurestaticapps.net
[CONFIG] Origin 3: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
[CORS] Request from origin: https://www.app.lobaiseo.com
[CORS] ✅ Origin https://www.app.lobaiseo.com is ALLOWED
```

### Frontend Should Work
- No more CORS errors
- Google Business Profile connection should work
- All API calls should succeed

## Troubleshooting

### If CORS Error Persists

1. **Check logs in Azure Portal**
   - App Service > Log stream
   - Look for CORS-related messages

2. **Verify environment variables**
   ```bash
   # In Azure Portal
   App Service > Configuration > Environment variables

   # Check that NODE_ENV=production and RUN_MODE=AZURE are set
   ```

3. **Clear browser cache**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
   - Or open in incognito/private window

4. **Check frontend is pointing to correct backend**
   - Frontend .env should have:
   ```
   VITE_BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
   ```

### If Variables Don't Persist

Some Azure configurations may not persist if using Container Apps instead of App Service:
- For Azure Container Apps: Set environment variables in Container configuration
- For Azure App Service: Use Configuration > Environment variables
- Both require a restart after changes

## Additional Resources

- Azure App Service Configuration: https://docs.microsoft.com/en-us/azure/app-service/configure-common
- CORS in Express: https://expressjs.com/en/resources/middleware/cors.html
- Your config.js: `server/config.js:230-265` (CORS origins logic)
- Your server.js: `server/server.js:65-90` (CORS middleware)

## Summary

1. Set `NODE_ENV=production` in Azure App Service
2. Set `RUN_MODE=AZURE` in Azure App Service
3. Set `FRONTEND_URL=https://www.app.lobaiseo.com` in Azure App Service
4. Restart the App Service
5. Test your frontend - CORS error should be gone!

The code already has the correct CORS configuration - it just needs the environment variables to activate it!
