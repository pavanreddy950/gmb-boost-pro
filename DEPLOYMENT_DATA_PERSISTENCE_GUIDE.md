# Deployment & Data Persistence Guide

## Overview
Your app now uses a **hybrid storage system** that ensures subscription data persists even when you push code to production.

## How It Works

### Hybrid Storage System
```
┌─────────────────────────────────────┐
│   Subscription Data Storage         │
├─────────────────────────────────────┤
│                                     │
│  ┌──────────────┐  ┌─────────────┐ │
│  │  Firestore   │  │ File-Based  │ │
│  │  (Cloud DB)  │  │ (Local)     │ │
│  └──────────────┘  └─────────────┘ │
│         │                 │         │
│         └────── Both ─────┘         │
│           Write to Both             │
│           Read from Cloud First     │
└─────────────────────────────────────┘
```

### Storage Layers

1. **Firestore (Primary)** - Cloud Database
   - ✅ Persists across deployments
   - ✅ Survives code pushes
   - ✅ Accessible from anywhere
   - 📍 Location: Firebase Cloud

2. **File Storage (Backup)** - Local JSON Files
   - ✅ Works without internet
   - ✅ Fast local access
   - ⚠️ Only persists if files are committed to git
   - 📍 Location: `server/data/subscriptions.json`

## Setup Instructions

### Step 1: Configure Firebase (Required for Cloud Persistence)

#### Option A: Using Environment Variable (Recommended for Production)
```bash
# In your Azure/server environment, set this variable:
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account","project_id":"your-project-id",...}'
```

#### Option B: Using Service Account File (Development)
```bash
# Place your Firebase service account JSON file here:
server/serviceAccountKey.json
```

#### Option C: Using Google Application Credentials
```bash
# Set environment variable pointing to the file:
GOOGLE_APPLICATION_CREDENTIALS=server/serviceAccountKey.json
```

### Step 2: Verify Firebase Setup

Check if Firebase is configured on your server:
```bash
cd server
npm run dev
```

Look for these logs:
```
[Firebase] ✅ Firebase Admin SDK initialized successfully
[Firebase] Project ID: your-project-id
[FirestoreSubscriptionService] ✅ Initialized with Firestore
[HybridSubscriptionService] ✅ Using Firestore + file-based storage (hybrid mode)
```

### Step 3: Git Ignore Strategy

Your `.gitignore` is already configured correctly:
```
# Tracked (will be pushed):
server/data/subscriptions.json          ✅ Tracked
server/data/userGbpMapping.json         ✅ Tracked

# Not tracked (secrets):
**/serviceAccountKey.json               🔒 Secret
**/*firebase*adminsdk*.json             🔒 Secret
```

## Data Flow Scenarios

### Scenario 1: Normal Operation (Both Systems Working)
```
User makes payment
    ↓
Saves to Firestore ✅
    ↓
Also saves to local file ✅
    ↓
Data is safe in cloud
```

### Scenario 2: Firestore Unavailable
```
User makes payment
    ↓
Firestore fails (no credentials)
    ↓
Falls back to file storage ✅
    ↓
Data saved locally (but will be lost if not committed)
```

### Scenario 3: Push Code to Azure
```
Developer pushes code
    ↓
Git only pushes code changes
    ↓
Firestore data remains in cloud ✅
    ↓
Server restarts and loads from Firestore ✅
    ↓
Users see their subscriptions unchanged
```

## Deployment Checklist

### Before Deploying

- [ ] **Set Firebase credentials** in Azure environment variables
- [ ] **Commit data files** if using file-only mode:
  ```bash
  git add server/data/subscriptions.json
  git add server/data/userGbpMapping.json
  git commit -m "Update subscription data"
  ```
- [ ] **Test Firebase connection** locally first
- [ ] **Verify `.gitignore`** doesn't block data files

### Deploy to Azure

```bash
# Option 1: Using npm script
npm run build:azure
git add dist
git commit -m "Build for production"
git push azure main

# Option 2: Direct push
git push azure main
```

### After Deploying

- [ ] Check server logs for Firebase initialization
- [ ] Test creating a new subscription
- [ ] Verify existing subscriptions still work
- [ ] Check both Firestore console and file storage

## Setting Azure Environment Variables

### Via Azure Portal
1. Go to Azure Portal → Your App Service
2. Navigate to: **Configuration** → **Application settings**
3. Click **+ New application setting**
4. Add:
   ```
   Name: FIREBASE_SERVICE_ACCOUNT_KEY
   Value: {"type":"service_account","project_id":"...",...}
   ```
5. Click **Save**
6. **Restart** the app service

### Via Azure CLI
```bash
az webapp config appsettings set \
  --resource-group <your-resource-group> \
  --name <your-app-name> \
  --settings FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

## Troubleshooting

### Issue 1: Subscriptions Disappear After Deployment

**Cause**: Firebase not configured, and data files not committed

**Solution**:
```bash
# Check Firebase status in logs
# Look for: "[Firebase] ❌ Failed to initialize"

# If Firebase is missing, either:
# 1. Add Firebase credentials (recommended)
# 2. Or commit data files before pushing:
git add server/data/subscriptions.json
git commit -m "Preserve subscription data"
git push
```

### Issue 2: "Firestore unavailable" Warning

**Cause**: Firebase credentials not set

**Solution**:
1. Get your Firebase service account key from Firebase Console
2. Go to: **Project Settings** → **Service Accounts** → **Generate New Private Key**
3. Copy the JSON content
4. Set as environment variable in Azure

### Issue 3: Data Sync Issues Between Firestore and File

**Cause**: One storage method has newer data

**Solution**:
```javascript
// The system automatically syncs:
// - Reads from Firestore first
// - Falls back to file if Firestore fails
// - Writes to both on every update
```

## Monitoring Data Persistence

### Check Firestore Console
1. Go to Firebase Console → Firestore Database
2. Look for collections:
   - `subscriptions` - All subscription data
   - `userGbpMappings` - User-to-GBP account mappings
3. Verify records exist and are up-to-date

### Check File Storage
```bash
# View subscription data
cat server/data/subscriptions.json

# Check last modified time
ls -lh server/data/subscriptions.json
```

### Check Hybrid System Status
```bash
# Server logs will show:
[HybridSubscriptionService] ✅ Using Firestore + file-based storage (hybrid mode)
# OR
[HybridSubscriptionService] ⚠️ Firestore unavailable, using file-based storage only
```

## Best Practices

### ✅ DO:
- Set Firebase credentials in production
- Test deployments in a staging environment first
- Monitor both Firestore and file storage
- Keep data files tracked in git as backup
- Regularly check server logs for storage errors

### ❌ DON'T:
- Commit serviceAccountKey.json (it's a secret!)
- Delete data files without checking Firestore first
- Deploy without testing Firebase connection
- Forget to set environment variables in Azure
- Push code changes without verifying data persistence

## Migration from File-Only to Hybrid

If you have existing data in files only:

```bash
# 1. Ensure Firebase is configured
# 2. Start the server - it will automatically migrate
# 3. Check logs for:
[HybridSubscriptionService] Synced subscription to Firestore
# 4. Verify in Firebase Console
```

The system automatically syncs existing file data to Firestore on first read!

## Files Modified in This Update

### New Files Created:
- `server/services/firestoreSubscriptionService.js` - Cloud storage service
- `server/services/hybridSubscriptionService.js` - Hybrid storage orchestrator

### Files Modified:
- `server/services/subscriptionService.js` - Now uses hybrid storage
- `src/components/ProfileDetails/AutoPostingTab.tsx` - Fixed CTA button phone number handling

### Files Tracked by Git:
- `server/data/subscriptions.json` ✅
- `server/data/userGbpMapping.json` ✅

## Support

If you encounter issues:
1. Check server logs for storage initialization
2. Verify Firebase credentials are set
3. Confirm data files are tracked by git
4. Test locally before deploying

---

**Last Updated**: 2025-01-07
**System Version**: Hybrid Storage v1.0
