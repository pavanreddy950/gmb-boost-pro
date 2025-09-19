# 🚀 Pavan Client Backend - Deployment with Payment Persistence Fixes

This deployment includes critical fixes for payment persistence and trial day counting issues.

## 🔧 Fixes Included

### ✅ Payment Persistence Fix
- **Issue**: Users were asked to pay again after logout because payment history was lost
- **Solution**: Added user ID-based subscription lookup system
- **Impact**: Payment history now persists across sessions

### ✅ Trial Day Counting Fix
- **Issue**: Incorrect day counting due to `Math.ceil()` always rounding up
- **Solution**: Implemented accurate calculation using `Math.floor()` with proper logic
- **Impact**: Users see correct remaining days in their trial period

### ✅ User-GBP Mapping System
- **Feature**: Automatic association between Firebase users and Google Business Profile accounts
- **Benefit**: Subscription lookup works even when GBP is temporarily disconnected
- **Storage**: Persistent bidirectional mapping in `userGbpMapping.json`

### ✅ Enhanced API Endpoints
- **New**: `/api/payment/user/gbp-association` for storing user-GBP mappings
- **Enhanced**: `/api/payment/subscription/status` now supports both `userId` and `gbpAccountId`
- **Improved**: Better error handling and fallback mechanisms

## 🏗️ Deployment Instructions

### Prerequisites
1. Ensure Docker Desktop is installed and running
2. Have access to `scale112/pavan-client-backend` Docker Hub repository
3. Be logged into Docker Hub (`docker login`)

### Option 1: Automated Deployment (Recommended)

#### Windows:
```bash
cd server
deploy-with-fixes.bat
```

#### Linux/Mac:
```bash
cd server
./deploy-with-fixes.sh
```

### Option 2: Manual Deployment

```bash
# Navigate to server directory
cd server

# Build the image with all fixes
docker-compose -f docker-compose.pavan-client.yml build --no-cache

# Tag for Docker Hub
docker tag pavan-client-backend:latest scale112/pavan-client-backend:latest

# Login to Docker Hub (if not already logged in)
docker login

# Push to Docker Hub
docker push scale112/pavan-client-backend:latest
```

## 🔄 Updating Existing Deployments

### For Azure Container Instances
```bash
# Azure will automatically pull latest image on restart
az container restart --resource-group your-rg --name pavan-client-backend
```

### For Docker Compose Deployments
```bash
# Stop current container
docker-compose -f docker-compose.pavan-client.yml down

# Pull latest image
docker pull scale112/pavan-client-backend:latest

# Start with updated image
docker-compose -f docker-compose.pavan-client.yml up -d
```

### For Manual Docker Deployments
```bash
# Stop and remove current container
docker stop pavan-client
docker rm pavan-client

# Pull latest image
docker pull scale112/pavan-client-backend:latest

# Run new container
docker run -d -p 5000:5000 \
  --name pavan-client \
  -e NODE_ENV=production \
  -e FRONTEND_URL=your_frontend_url \
  scale112/pavan-client-backend:latest
```

## 🧪 Testing the Fixes

### 1. Payment Persistence Test
1. Login to the application
2. Make a payment (or use existing paid account)
3. Logout completely
4. Login again
5. ✅ Payment history should be visible immediately
6. ✅ No "pay again" prompts should appear

### 2. Trial Day Counting Test
1. Check a trial account's remaining days
2. Compare with manual calculation
3. ✅ Days should be accurate (not rounded up artificially)

### 3. API Endpoints Test
```bash
# Test user ID lookup (replace with actual user ID)
curl "https://your-backend-url/api/payment/subscription/status?userId=USER_ID"

# Test GBP account lookup (replace with actual GBP account ID)
curl "https://your-backend-url/api/payment/subscription/status?gbpAccountId=GBP_ACCOUNT_ID"

# Both should return the same subscription data
```

## 📊 New Data Files

The backend now creates these additional data files:

```
server/data/
├── subscriptions.json          # Existing subscription data
├── userGbpMapping.json        # New: User-GBP associations
├── automationSettings.json    # Existing automation settings
└── qrCodes.json               # Existing QR codes
```

## 🔒 Environment Variables

No new environment variables required. All fixes use existing configuration.

## 🌐 Docker Hub Repository

**Repository**: `scale112/pavan-client-backend:latest`
**URL**: https://hub.docker.com/r/scale112/pavan-client-backend

## 📝 Version Information

- **Build Date**: September 15, 2025
- **Version**: Latest (with payment persistence fixes)
- **Node.js**: 18-alpine
- **Port**: 5000
- **Health Check**: `/health` endpoint

## 🆘 Troubleshooting

### Build Issues
```bash
# Clear Docker cache and rebuild
docker system prune -a
docker-compose -f docker-compose.pavan-client.yml build --no-cache
```

### Push Issues
```bash
# Re-login to Docker Hub
docker logout
docker login

# Verify image exists
docker images | grep pavan-client-backend

# Re-tag and push
docker tag pavan-client-backend:latest scale112/pavan-client-backend:latest
docker push scale112/pavan-client-backend:latest
```

### Runtime Issues
```bash
# Check container logs
docker logs pavan-client

# Check container health
docker exec pavan-client curl http://localhost:5000/health
```

## ✅ Deployment Checklist

- [ ] Docker Desktop is running
- [ ] Logged into Docker Hub
- [ ] Built image with `--no-cache` flag
- [ ] Tagged image correctly
- [ ] Pushed to Docker Hub successfully
- [ ] Updated production deployments
- [ ] Tested payment persistence functionality
- [ ] Verified trial day counting accuracy
- [ ] Confirmed API endpoints are working

## 🎉 Success Indicators

After successful deployment, you should see:

1. ✅ **Payment Persistence**: Users don't lose payment history after logout/login
2. ✅ **Accurate Trial Days**: Trial countdown shows correct remaining days
3. ✅ **API Response**: Both user ID and GBP ID lookups return subscription data
4. ✅ **Mapping File**: `userGbpMapping.json` contains user associations
5. ✅ **Logs**: No errors related to subscription lookup or payment validation

---

**Deployment completed by**: Claude Code Assistant
**Date**: September 15, 2025
**Issues Fixed**: Payment persistence, trial day counting, user-GBP mapping