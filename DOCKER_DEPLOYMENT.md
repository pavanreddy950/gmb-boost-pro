# Docker Backend Deployment Guide

## ✅ Latest Updates Deployed

The backend has been successfully built and pushed to Docker Hub with:
- ✅ **CTA button phone number fix** - Buttons now properly use verified business phone numbers
- ✅ **Hybrid subscription storage** - Data persists in both Firestore and local storage
- ✅ **All async subscription methods** - Proper async/await for data persistence

**Docker Image**: `scale112/gmb-boost-pro-backend:latest`
**Digest**: `sha256:cef6383f0960e70556498f22465667d107dce2358ff97e300ba6324a9a82bda0`

---

## Quick Deploy Commands

### Option 1: Deploy with Docker Compose (Recommended)

```bash
cd server

# Pull and start the latest version
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d

# Check status
docker compose -f docker-compose.hub.yml ps

# View logs
docker compose -f docker-compose.hub.yml logs -f
```

### Option 2: Deploy with Docker Run

```bash
# Stop and remove old container
docker stop gmb-boost-pro-backend-hub
docker rm gmb-boost-pro-backend-hub

# Pull latest image
docker pull scale112/gmb-boost-pro-backend:latest

# Run new container
docker run -d \
  --name gmb-boost-pro-backend-hub \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com \
  -e GOOGLE_CLIENT_SECRET=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 \
  -e FRONTEND_URL=https://polite-wave-08ec8c90f.1.azurestaticapps.net \
  -e BACKEND_URL=https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net \
  -e GOOGLE_REDIRECT_URI=https://polite-wave-08ec8c90f.1.azurestaticapps.net/auth/google/callback \
  -e RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI \
  -e RAZORPAY_KEY_SECRET=7i0iikfS6eO7w4DSLXldCBX5 \
  -e RAZORPAY_WEBHOOK_SECRET=gmb_boost_pro_webhook_secret_2024 \
  --restart unless-stopped \
  scale112/gmb-boost-pro-backend:latest
```

---

## Verify Deployment

### 1. Check Container Status
```bash
docker ps | grep gmb-boost-pro-backend
```

### 2. Check Health
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{"status":"ok","timestamp":"2025-01-07T..."}
```

### 3. Check Logs for Initialization
```bash
docker logs gmb-boost-pro-backend-hub --tail 50
```

Look for these success indicators:
```
[Firebase] ✅ Firebase Admin SDK initialized successfully
[FirestoreSubscriptionService] ✅ Initialized with Firestore
[HybridSubscriptionService] ✅ Using Firestore + file-based storage (hybrid mode)
[AutomationScheduler] ✅ Azure OpenAI Configuration (Hardcoded)
```

### 4. Test Key Features

**Test Subscription Endpoint:**
```bash
curl http://localhost:5000/api/subscription/status
```

**Test Auto-posting:**
```bash
curl -X POST http://localhost:5000/api/automation/test-post-now/YOUR_LOCATION_ID \
  -H "Content-Type: application/json" \
  -H "X-User-ID: YOUR_USER_ID" \
  -d '{
    "businessName": "Test Business",
    "category": "restaurant",
    "phoneNumber": "+1234567890",
    "button": {
      "enabled": true,
      "type": "call_now",
      "phoneNumber": "+1234567890"
    }
  }'
```

---

## Environment Variables (Important!)

### Required for Firebase/Firestore (Cloud Persistence)

Add to your docker-compose.hub.yml or docker run command:

```yaml
environment:
  # ... existing variables ...

  # Firebase Configuration (ADD THIS!)
  - FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account","project_id":"your-project",...}
```

**How to get Firebase Service Account Key:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to: **Project Settings** → **Service Accounts**
4. Click **"Generate New Private Key"**
5. Copy the entire JSON content
6. Add it as the `FIREBASE_SERVICE_ACCOUNT_KEY` environment variable

---

## Update Workflow

### When You Make Backend Changes

```bash
# 1. Navigate to server directory
cd server

# 2. Build new Docker image
docker build -t scale112/gmb-boost-pro-backend:latest .

# 3. Push to Docker Hub
docker push scale112/gmb-boost-pro-backend:latest

# 4. Deploy updated image
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d

# 5. Verify deployment
docker logs gmb-boost-pro-backend-hub --tail 50
```

### Quick Update Script

Save this as `deploy-backend.sh` in the server directory:

```bash
#!/bin/bash
set -e

echo "🔨 Building Docker image..."
docker build -t scale112/gmb-boost-pro-backend:latest .

echo "📤 Pushing to Docker Hub..."
docker push scale112/gmb-boost-pro-backend:latest

echo "🔄 Updating deployment..."
docker compose -f docker-compose.hub.yml pull
docker compose -f docker-compose.hub.yml up -d

echo "✅ Deployment complete!"
echo ""
echo "📋 Container status:"
docker ps | grep gmb-boost-pro-backend

echo ""
echo "📝 Recent logs:"
docker logs gmb-boost-pro-backend-hub --tail 20
```

Make it executable:
```bash
chmod +x deploy-backend.sh
```

Run it:
```bash
./deploy-backend.sh
```

---

## Rollback (If Something Goes Wrong)

### Option 1: Rollback to Previous Version

```bash
# Find previous image digest from Docker Hub
# Then pull specific version:
docker pull scale112/gmb-boost-pro-backend@sha256:PREVIOUS_DIGEST

# Tag it as latest
docker tag scale112/gmb-boost-pro-backend@sha256:PREVIOUS_DIGEST scale112/gmb-boost-pro-backend:latest

# Restart
docker compose -f docker-compose.hub.yml up -d
```

### Option 2: View Image History

```bash
# List all backend images
docker images scale112/gmb-boost-pro-backend

# View image history
docker history scale112/gmb-boost-pro-backend:latest
```

---

## Troubleshooting

### Issue: Container Keeps Restarting

```bash
# Check logs
docker logs gmb-boost-pro-backend-hub

# Common causes:
# 1. Missing environment variables
# 2. Port 5000 already in use
# 3. Firebase credentials invalid
```

### Issue: "Cannot find module" Errors

```bash
# Rebuild without cache
docker build --no-cache -t scale112/gmb-boost-pro-backend:latest .
docker push scale112/gmb-boost-pro-backend:latest
```

### Issue: Database/Firestore Errors

```bash
# Check if Firebase is configured
docker logs gmb-boost-pro-backend-hub | grep Firebase

# Should see:
# [Firebase] ✅ Firebase Admin SDK initialized successfully

# If not, add FIREBASE_SERVICE_ACCOUNT_KEY to environment variables
```

### Issue: "Subscription data disappeared"

**Cause**: Firestore not configured, container restarted

**Solution**:
1. Add Firebase credentials (see above)
2. Or restore from git history (if using file storage):
   ```bash
   git checkout HEAD -- server/data/subscriptions.json
   docker cp server/data/subscriptions.json gmb-boost-pro-backend-hub:/app/data/
   ```

---

## Monitoring

### View Real-time Logs

```bash
docker logs -f gmb-boost-pro-backend-hub
```

### Check Resource Usage

```bash
docker stats gmb-boost-pro-backend-hub
```

### Inspect Container

```bash
docker inspect gmb-boost-pro-backend-hub
```

### Execute Commands Inside Container

```bash
# Access container shell
docker exec -it gmb-boost-pro-backend-hub sh

# Check files inside
docker exec gmb-boost-pro-backend-hub ls -la /app/data

# View environment variables
docker exec gmb-boost-pro-backend-hub env
```

---

## Security Notes

⚠️ **Never commit these to git:**
- Firebase service account keys
- Razorpay secrets
- Google OAuth secrets

✅ **Safe to commit:**
- docker-compose.yml (without secrets)
- Dockerfile
- .dockerignore

🔒 **Use environment variables for all secrets!**

---

## What's Included in Latest Image

### New Features:
- ✅ Hybrid subscription storage (Firestore + File)
- ✅ CTA button phone number support
- ✅ Async subscription methods
- ✅ Automatic data migration to Firestore

### Fixed Issues:
- ✅ CTA buttons now use verified phone numbers
- ✅ Subscriptions persist across deployments
- ✅ Proper async/await throughout codebase

### Files Added:
- `server/services/firestoreSubscriptionService.js`
- `server/services/hybridSubscriptionService.js`

### Files Modified:
- `server/services/subscriptionService.js`
- All subscription-related endpoints now use async methods

---

**Last Updated**: 2025-01-07
**Image**: scale112/gmb-boost-pro-backend:latest
**Digest**: sha256:cef6383f0960e70556498f22465667d107dce2358ff97e300ba6324a9a82bda0
