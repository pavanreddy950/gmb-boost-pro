# Render Blueprint Setup - Proper Way to Deploy

## Problem
The Render static site `lobaiseofrontend` was created manually and doesn't use the `render.yaml` configuration which has proper SPA routing.

## Solution: Use Blueprint

### Step 1: Go to Render Dashboard
1. https://dashboard.render.com/
2. Click **"New +"** button (top right)
3. Select **"Blueprint"**

### Step 2: Connect Repository
1. Select source: **GitHub**
2. Find repository: **pavanreddy950/gmb-boost-pro**
3. Click **"Connect"**

### Step 3: Review Configuration
Render will detect `render.yaml` and show:

**Services to be created:**
- `lobaiseo-backend-yjnl` (Web Service) - Backend API
- `lobaiseofrontend` (Static Site) - Frontend

**Important:** If `lobaiseofrontend` already exists, either:
- Delete the old one first, OR
- Rename it in the yaml before applying

### Step 4: Apply Blueprint
1. Review the configuration
2. Click **"Apply"**
3. Render will create/update services with proper routing from yaml

### Step 5: Wait for Deployment
- Backend: ~3-5 minutes
- Frontend: ~3-5 minutes

### Step 6: Verify
After deployment:

```bash
# Should return 200 OK (not 404!)
curl -I https://www.app.lobaiseo.com/auth/google/callback
```

---

## What the Blueprint Does

The `render.yaml` includes proper SPA routing:

```yaml
routes:
  - type: rewrite
    source: /*
    destination: /index.html
```

This ensures ALL routes serve `index.html`, letting React Router handle navigation.

---

## After Blueprint Deployment

Test OAuth:
1. Go to: https://www.app.lobaiseo.com
2. Login → Settings → Connections
3. Click "Connect Google Business Profile"
4. URL should be: `www.app.lobaiseo.com/auth/google/callback` (NO #!)
5. OAuth completes successfully ✅
