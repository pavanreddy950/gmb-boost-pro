# Render Environment Variables Setup Guide

## Critical Issue: Missing Supabase Configuration

Your deployment is failing because Supabase environment variables are not configured on Render.

## Required Environment Variables

### 1. Supabase Configuration (CRITICAL - Currently Missing)

```bash
SUPABASE_URL=https://hsgdksgbvbdkkmhxlbkn.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZ2Rrc2didmJka2ttaHhsYmtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDUyMjUwNSwiZXhwIjoyMDUwMDk4NTA1fQ.ZhsIJfDjLn3a1vPUPaP5gN1HdUxqG5kfOT1eD64o7CA
```

### 2. Token Encryption Key (CRITICAL)

```bash
TOKEN_ENCRYPTION_KEY=9lEZ/OZEdrzsh/ouKKCBAGUfmCJQLQynDWKIieRDyqk=
```

**NOTE:** This must be set as a SEPARATE variable called `TOKEN_ENCRYPTION_KEY`, NOT as the PORT variable!

### 3. Port Configuration (Important)

Render automatically sets the PORT variable. You should:
- **Option 1 (Recommended):** Don't set PORT at all - let Render manage it
- **Option 2:** Set `PORT=10000` explicitly

**DO NOT** set PORT to an encryption key or any other value!

### 4. All Environment Variables for Render Backend

Copy these to your Render backend service environment variables:

```bash
# Node Environment
NODE_ENV=production

# Supabase (Database)
SUPABASE_URL=https://hsgdksgbvbdkkmhxlbkn.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZ2Rrc2didmJka2ttaHhsYmtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDUyMjUwNSwiZXhwIjoyMDUwMDk4NTA1fQ.ZhsIJfDjLn3a1vPUPaP5gN1HdUxqG5kfOT1eD64o7CA

# Token Encryption
TOKEN_ENCRYPTION_KEY=9lEZ/OZEdrzsh/ouKKCBAGUfmCJQLQynDWKIieRDyqk=

# Backend URL
BACKEND_URL=https://lobaiseo-backend-yjnl.onrender.com

# Frontend URL
FRONTEND_URL=https://www.app.lobaiseo.com

# Google OAuth (Already configured from production defaults)
GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://www.app.lobaiseo.com/auth/google/callback
HARDCODED_ACCOUNT_ID=106433552101751461082

# Razorpay (Already configured from production defaults)
RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI
RAZORPAY_KEY_SECRET=7i0iikfS6eO7w4DSLXldCBX5
RAZORPAY_WEBHOOK_SECRET=gmb_boost_pro_webhook_secret_2024

# Azure OpenAI (Already configured from production defaults)
AZURE_OPENAI_ENDPOINT=https://agentplus.openai.azure.com/
AZURE_OPENAI_API_KEY=1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview

# Firebase
FIREBASE_PROJECT_ID=gbp-467810-a56e2
```

## Steps to Configure on Render

### Step 1: Access Environment Variables

1. Go to [Render Dashboard](https://dashboard.render.com/)
2. Select your **backend service** (lobaiseo-backend-yjnl)
3. Click on **"Environment"** in the left sidebar

### Step 2: Add Missing Variables

Click **"Add Environment Variable"** and add these one by one:

| Key | Value |
|-----|-------|
| `SUPABASE_URL` | `https://hsgdksgbvbdkkmhxlbkn.supabase.co` |
| `SUPABASE_SERVICE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZ2Rrc2didmJka2ttaHhsYmtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDUyMjUwNSwiZXhwIjoyMDUwMDk4NTA1fQ.ZhsIJfDjLn3a1vPUPaP5gN1HdUxqG5kfOT1eD64o7CA` |
| `TOKEN_ENCRYPTION_KEY` | `9lEZ/OZEdrzsh/ouKKCBAGUfmCJQLQynDWKIieRDyqk=` |
| `BACKEND_URL` | `https://lobaiseo-backend-yjnl.onrender.com` |

### Step 3: Verify PORT Variable

Check if `PORT` exists in your environment variables:
- If it's set to something like `9lEZ/OZEdrzsh/ouKKCBAGUfmCJQLQynDWKIieRDyqk=` → **DELETE IT**
- If it doesn't exist → **Leave it unset** (Render will auto-assign)
- If you want to set it explicitly → Set `PORT=10000`

### Step 4: Save and Redeploy

1. Click **"Save Changes"**
2. Render will automatically trigger a new deployment
3. Wait for deployment to complete

### Step 5: Verify Deployment

Once deployed, check:

1. **Health Check:**
   ```
   https://lobaiseo-backend-yjnl.onrender.com/health
   ```
   Should return: `{"status": "healthy"}`

2. **Check Logs:**
   - Look for: `✅ All required environment variables are configured`
   - Should NOT see: `Supabase credentials not found`

## Troubleshooting

### Error: "Supabase credentials not found"
- **Solution:** Add `SUPABASE_URL` and `SUPABASE_SERVICE_KEY` to environment variables

### Error: "listen EACCES: permission denied [strange value]"
- **Solution:** Check if PORT is set to wrong value (encryption key). Delete it or set to `10000`

### Error: "Token storage not initialized"
- **Solution:** Verify `TOKEN_ENCRYPTION_KEY` is set correctly as a separate variable

## Quick Copy-Paste for Render

```
SUPABASE_URL=https://hsgdksgbvbdkkmhxlbkn.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhzZ2Rrc2didmJka2ttaHhsYmtuIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNDUyMjUwNSwiZXhwIjoyMDUwMDk4NTA1fQ.ZhsIJfDjLn3a1vPUPaP5gN1HdUxqG5kfOT1eD64o7CA
TOKEN_ENCRYPTION_KEY=9lEZ/OZEdrzsh/ouKKCBAGUfmCJQLQynDWKIieRDyqk=
BACKEND_URL=https://lobaiseo-backend-yjnl.onrender.com
```

## What This Fixes

✅ Supabase connection for token storage
✅ Token encryption for security
✅ Correct port binding (no more EACCES error)
✅ All authentication features will work
✅ Automation will function properly
