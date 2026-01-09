# Update Existing Render Static Site for SPA Routing

## Alternative to Blueprint: Configure Existing Service

### Step 1: Go to Service Settings
1. https://dashboard.render.com/
2. Click on: `lobaiseofrontend`
3. Go to **"Settings"** tab

### Step 2: Check These Settings

#### A. Publish Directory
Should be: `dist`
(This is where your built files are)

#### B. Build Command
Should be: `npm install && npm run build`

#### C. Look for "404 Page" or "Error Document" Setting
If available, set to: `index.html`

This makes Render serve index.html for any 404 errors, enabling SPA routing.

### Step 3: If No 404/Error Document Option

The _redirects file should work automatically. If it's not working:

1. **Verify _redirects is in dist:**
   ```bash
   ls -la dist/_redirects
   ```
   Should exist and contain:
   ```
   /*    /index.html   200
   ```

2. **Force rebuild:**
   - In Render dashboard, click **"Manual Deploy"**
   - Select **"Clear build cache & deploy"**
   - This ensures _redirects is properly detected

### Step 4: Advanced - Add Custom Build Script

If _redirects still doesn't work, update build command:

**Old:**
```
npm install && npm run build
```

**New:**
```
npm install && npm run build && echo '/*    /index.html   200' > dist/_redirects
```

This ensures _redirects is always created, even if Vite misses it.

---

## Debugging

### Test if _redirects is working:

```bash
# All should return 200 OK
curl -I https://www.app.lobaiseo.com/
curl -I https://www.app.lobaiseo.com/login
curl -I https://www.app.lobaiseo.com/dashboard
curl -I https://www.app.lobaiseo.com/auth/google/callback
```

If still 404, the service isn't reading _redirects properly.

---

## Why This Matters

**Render Static Sites** should support `_redirects` file automatically, but:
- Service must be properly configured
- File must be in publish directory (dist)
- Sometimes needs manual deploy to pick up changes

If these don't work, the **Blueprint method** is the most reliable.
