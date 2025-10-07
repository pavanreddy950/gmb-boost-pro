# Quick Deployment Checklist ✅

## Before Every Deployment

### 1. Set Firebase Environment Variable in Azure ⚠️ CRITICAL
```bash
# Azure Portal → App Service → Configuration → Application Settings
# Add this:
Name: FIREBASE_SERVICE_ACCOUNT_KEY
Value: (Your Firebase service account JSON - get from Firebase Console)
```

**Without this, subscriptions WILL BE LOST on deployment!**

### 2. Verify Local Changes
```bash
# Check what's changed
git status

# Review changes
git diff
```

### 3. Build & Test Locally
```bash
# Frontend
npm run build:azure

# Backend (in new terminal)
cd server
npm run dev

# Test in browser
# Open http://localhost:3000
```

### 4. Commit & Push
```bash
# Add changes
git add .

# Commit with message
git commit -m "Fix: CTA button phone number and subscription persistence"

# Push to Azure
git push azure main
```

### 5. Verify Deployment
```bash
# Check if app is running
curl https://www.app.lobaiseo.com/

# Check server logs
az webapp log tail --name <your-app-name> --resource-group <your-rg>
```

### 6. Test Critical Features
- [ ] Login works
- [ ] Google Business Profile connection works
- [ ] Subscriptions show correctly
- [ ] CTA buttons work with phone numbers
- [ ] Auto-posting works

---

## Emergency: If Subscriptions Disappeared

### Option 1: Restore from Firestore (If configured)
```bash
# Data should automatically load from Firestore
# Check server logs for:
[HybridSubscriptionService] Retrieved subscription from Firestore
```

### Option 2: Restore from Git History
```bash
# Find the last good commit
git log --all -- server/data/subscriptions.json

# Restore the file
git checkout <commit-hash> -- server/data/subscriptions.json

# Commit and redeploy
git add server/data/subscriptions.json
git commit -m "Restore subscription data"
git push azure main
```

---

## Quick Azure Environment Variable Setup

```bash
# Login to Azure
az login

# Set Firebase credentials
az webapp config appsettings set \
  --resource-group <your-resource-group> \
  --name <your-app-name> \
  --settings FIREBASE_SERVICE_ACCOUNT_KEY='<your-json-here>'

# Restart app
az webapp restart \
  --resource-group <your-resource-group> \
  --name <your-app-name>
```

---

## Files Changed in This Update

✅ **Fixed Files:**
- `src/components/ProfileDetails/AutoPostingTab.tsx` - CTA button phone numbers
- `server/services/subscriptionService.js` - Now uses hybrid storage

✅ **New Files:**
- `server/services/firestoreSubscriptionService.js` - Cloud storage
- `server/services/hybridSubscriptionService.js` - Hybrid storage manager

---

## Common Issues & Quick Fixes

### Issue: "Firestore not available" in logs
**Fix**: Set `FIREBASE_SERVICE_ACCOUNT_KEY` in Azure environment variables

### Issue: CTA button shows "add phone number" despite having one
**Fix**: Already fixed in AutoPostingTab.tsx - redeploy

### Issue: Subscriptions reset after deployment
**Fix**: Configure Firebase OR commit data files before pushing

---

**Remember**: Always set Firebase credentials in Azure for production! 🔥
