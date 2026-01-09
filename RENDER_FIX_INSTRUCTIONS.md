# URGENT: Fix OAuth 404 Error - Render Static Site Configuration

## Problem
OAuth callback returns 404 because Render static site doesn't have SPA routing configured.

## Root Cause
The Render service `lobaiseofrontend` was created manually and doesn't use the `render.yaml` configuration.

## Solution: Configure SPA Routing in Render Dashboard

### Step 1: Login to Render
1. Go to: https://dashboard.render.com/
2. Find service: `lobaiseofrontend`
3. Click on it

### Step 2: Add Rewrite Rule
1. Click **"Settings"** tab (or "Environment" > "Redirects/Rewrites")
2. Look for **"Redirects/Rewrites"** or **"Routes"** section
3. Add this rewrite rule:

```
Type: rewrite
Source: /*
Destination: /index.html
```

### Step 3: Save and Redeploy
1. Click **"Save Changes"**
2. Service will automatically redeploy
3. Wait 2-3 minutes for deployment

### Step 4: Test
After deployment, test the OAuth callback URL:

```bash
curl -I https://www.app.lobaiseo.com/auth/google/callback
```

**Should return:**
```
HTTP/1.1 200 OK  ← Should be 200, not 404!
Content-Type: text/html
```

### Step 5: Test OAuth Flow
1. Go to: https://www.app.lobaiseo.com
2. Login
3. Go to Settings > Connections
4. Click "Connect Google Business Profile"
5. Complete OAuth
6. Should redirect to: `https://www.app.lobaiseo.com/auth/google/callback` (NO # symbol!)

---

## Alternative: Deploy from render.yaml (If Above Doesn't Work)

If Render dashboard doesn't have rewrite rules option, you'll need to recreate the service from `render.yaml`:

### Steps:
1. In Render dashboard, go to `lobaiseofrontend` service
2. Delete the service (or rename it)
3. Create new service:
   - Click **"New" > "Blueprint"**
   - Connect to GitHub repo: `pavanreddy950/gmb-boost-pro`
   - Render will detect `render.yaml`
   - Click **"Apply"**
4. This will create services with proper routing from render.yaml

---

## Verification

After fixing, these URLs should work:

✅ https://www.app.lobaiseo.com → 200 OK
✅ https://www.app.lobaiseo.com/login → 200 OK
✅ https://www.app.lobaiseo.com/dashboard → 200 OK
✅ https://www.app.lobaiseo.com/auth/google/callback → 200 OK (CRITICAL!)

All should return `index.html` with 200 status, NOT 404.

---

## Why This Happens

Static site hosts like Render, Netlify, Vercel need explicit configuration to handle SPAs:

**Without SPA config:**
```
GET /auth/google/callback
  → Looks for file: dist/auth/google/callback.html
  → Not found → 404 ❌
```

**With SPA config (rewrite rule):**
```
GET /auth/google/callback
  → Rewrite: /* → /index.html
  → Serves: dist/index.html
  → React Router handles /auth/google/callback ✅
```

---

## Current Configuration Files

### ✅ render.yaml (in repo)
Has correct routing config:
```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

### ✅ public/_redirects (in repo)
Has correct config for Netlify-style redirects:
```
/*    /index.html   200
```

**BUT** these files only work if:
1. Service is created via Blueprint (render.yaml)
2. OR manually configured in dashboard

Since neither is active, OAuth returns 404.
