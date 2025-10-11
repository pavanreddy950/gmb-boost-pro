# Deploy Supabase Dependency Fix to Azure

## Problem Solved
Your Azure backend was crashing with "503 Service Unavailable" because `@supabase/supabase-js` package was missing from `package.json`, even though the code was trying to import it.

## What Was Fixed
- ✅ Added `@supabase/supabase-js": "^2.39.0"` to `server/package.json`
- ✅ Installed dependencies locally
- ✅ Environment variables are already configured correctly in Azure
- ⏳ **Now you need to rebuild and redeploy the Docker image**

## Deployment Steps

### Step 1: Start Docker Desktop

1. Open **Docker Desktop** application on your computer
2. Wait for it to fully start (you'll see the Docker icon in system tray)
3. Verify Docker is running:
   ```bash
   docker --version
   ```

### Step 2: Build New Docker Image

From your project root directory:

```bash
cd server
docker build -t scale112/pavan-client-backend:latest -t scale112/pavan-client-backend:v7-supabase-fix .
```

This will:
- Build a new Docker image with the updated package.json
- Tag it as both `latest` and `v7-supabase-fix`
- Install @supabase/supabase-js as part of the build process

Expected output: You'll see multiple steps, ending with:
```
Successfully built [image-id]
Successfully tagged scale112/pavan-client-backend:latest
Successfully tagged scale112/pavan-client-backend:v7-supabase-fix
```

### Step 3: Login to Docker Hub

```bash
docker login
```

Enter your Docker Hub credentials:
- Username: `scale112`
- Password: Your Docker Hub password/token

### Step 4: Push Image to Docker Hub

```bash
docker push scale112/pavan-client-backend:latest
docker push scale112/pavan-client-backend:v7-supabase-fix
```

This uploads the new image to Docker Hub so Azure can pull it.

Expected output:
```
The push refers to repository [docker.io/scale112/pavan-client-backend]
...
latest: digest: sha256:... size: ...
```

### Step 5: Deploy to Azure

#### Option A: Azure Portal (Recommended)

1. Go to https://portal.azure.com
2. Navigate to **pavan-client-backend-bxgdaqhvarfdeuhe** App Service
3. Click **Overview** > **Restart** button
4. Wait 2-3 minutes for Azure to:
   - Stop the current container
   - Pull the new `scale112/pavan-client-backend:latest` image
   - Start the new container with @supabase/supabase-js installed

#### Option B: Force Image Refresh (If simple restart doesn't work)

1. Go to **Deployment** > **Deployment Center**
2. Click **Sync** to force Azure to pull the latest image
3. Monitor the **Logs** tab to see pull progress

### Step 6: Verify Deployment

#### Test 1: Health Check
```bash
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
```

**Expected:** `{"status":"ok","timestamp":"..."}`
**If you see:** `Application Error` or `503` - wait 2 more minutes, container might still be starting

#### Test 2: Check Logs in Azure Portal

1. Go to **Monitoring** > **Log stream**
2. Look for these messages:
   ```
   ✅ Loaded configuration from .env.azure
   [Supabase] Initializing Supabase client...
   [Supabase] ✅ Supabase client initialized successfully
   [SERVER] Starting with allowed origins:
   [CONFIG] Origin 1: https://www.app.lobaiseo.com
   🚀 Server running on port 5000
   ```

#### Test 3: Test Frontend CORS
1. Open https://www.app.lobaiseo.com in a **new incognito window**
2. Login to your account
3. Try connecting to Google Business Profile
4. **Expected:** OAuth popup/redirect with no CORS errors
5. **If CORS error persists:** Hard refresh (Ctrl+Shift+R) or clear browser cache

### Step 7: Test CORS Headers

```bash
curl -X OPTIONS https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/auth/google/url \
  -H "Origin: https://www.app.lobaiseo.com" \
  -H "Access-Control-Request-Method: GET" \
  -I
```

**Expected headers:**
```
HTTP/1.1 200 OK
Access-Control-Allow-Origin: https://www.app.lobaiseo.com
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS, HEAD
Access-Control-Allow-Credentials: true
```

## Troubleshooting

### Issue: Docker build fails with "Cannot find module '@supabase/supabase-js'"

**Solution:** Make sure you're in the `server` directory and the updated `package.json` is present:
```bash
cd server
cat package.json | grep supabase
```

Should show: `"@supabase/supabase-js": "^2.39.0",`

### Issue: "Application Error" persists after restart

**Possible causes:**
1. Azure hasn't pulled the new image yet - wait 5 minutes
2. Image push didn't complete - check Docker Hub
3. Container is crashing for another reason - check Azure logs

**Solutions:**
1. Check Docker Hub to verify the new image was pushed: https://hub.docker.com/r/scale112/pavan-client-backend/tags
2. Look at the timestamp - it should be very recent
3. Check Azure Log Stream for specific error messages
4. Try **Stop** > wait 1 minute > **Start** instead of just Restart

### Issue: CORS errors still appearing

**Solutions:**
1. Clear browser cache completely
2. Try in incognito/private window
3. Verify CORS headers using curl (Step 7)
4. Check Azure logs to see if the allowed origins are configured correctly

### Issue: Docker push says "denied: requested access to the resource is denied"

**Solution:** You're not logged in to Docker Hub:
```bash
docker login
# Enter scale112 credentials
```

### Issue: "Cannot connect to Docker daemon"

**Solution:** Docker Desktop is not running
1. Start Docker Desktop application
2. Wait for it to fully start
3. Try the build command again

## Quick Command Summary

```bash
# 1. Start Docker Desktop (manually)

# 2. Build image
cd server
docker build -t scale112/pavan-client-backend:latest -t scale112/pavan-client-backend:v7-supabase-fix .

# 3. Login to Docker Hub
docker login

# 4. Push image
docker push scale112/pavan-client-backend:latest
docker push scale112/pavan-client-backend:v7-supabase-fix

# 5. Restart Azure (in Azure Portal)

# 6. Test health
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

# 7. Test frontend
# Go to https://www.app.lobaiseo.com in incognito window
```

## What This Fix Does

1. **Adds @supabase/supabase-js dependency** - The app can now import Supabase client without crashing
2. **Fixes Module Not Found error** - Node.js will find the package during `import` statements
3. **Enables Supabase features** - All Supabase-based services will work (token storage, subscriptions, etc.)
4. **Resolves 503 errors** - The app will start successfully instead of crashing on startup
5. **Fixes CORS errors** - Once the app starts, the CORS configuration will work correctly

## Timeline

- **Build time:** 2-5 minutes
- **Push time:** 1-3 minutes
- **Azure pull + restart:** 2-5 minutes
- **Total:** 5-15 minutes from start to finish

## Verification Checklist

After deployment, verify:

- [ ] Health endpoint returns `{"status":"ok"}`
- [ ] No "Application Error" in browser
- [ ] Azure logs show successful startup
- [ ] Azure logs show Supabase initialization success
- [ ] CORS headers include `Access-Control-Allow-Origin: https://www.app.lobaiseo.com`
- [ ] Frontend can connect to backend without CORS errors
- [ ] Google Business Profile connection works

## Success!

Once all checks pass:
- ✅ Your backend will be running properly
- ✅ CORS errors will be resolved
- ✅ Google Business Profile connection will work
- ✅ All Supabase features will be operational

## Need Help?

If you encounter any issues during deployment, check:
1. Docker Hub to verify image was pushed: https://hub.docker.com/r/scale112/pavan-client-backend/tags
2. Azure Log Stream for detailed error messages
3. This file for troubleshooting solutions
