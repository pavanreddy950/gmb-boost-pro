# 🚀 Azure Deployment Update - Force Pull Latest Image

## Issue
Azure App Service is still running an old Docker image despite pushing the latest fix to Docker Hub.

**Evidence**: Azure logs show `CouponService is not a constructor` error, which was fixed in the latest image.

---

## Latest Docker Image Details

**Image**: `scale112/pavan-client-backend:latest`
**Digest**: `sha256:f8b7a738527efeb25b0b51b3590f92b3a179f9476536f2d357c08976aa516ffb`
**Built**: November 21, 2025
**Contains**:
- ✅ Fixed CouponService imports in payment.js and admin.js
- ✅ Coupon service using Supabase (singleton pattern)
- ✅ Fixed coupon discount applied to Razorpay plan amount
- ✅ Coupon usage tracking in payment verification
- ✅ All previous auto-posting and timezone fixes

---

## Step-by-Step: Force Azure to Pull Latest Image

### Method 1: Restart with Webhook (Recommended)

1. **Go to Azure Portal**
   - URL: https://portal.azure.com
   - Login with your credentials

2. **Find Your App Service**
   - Search for: `pavan-client-backend-bxgdaqhvarfdeuhe`
   - Click on the App Service

3. **Open Deployment Center**
   - Left sidebar → Click **Deployment Center**

4. **Trigger Webhook**
   - You should see Docker Hub configuration
   - Look for **Webhook URL** section
   - Click **Restart** or **Redeploy**
   - Wait 2-3 minutes for container to restart

5. **Monitor Deployment**
   - Click **Logs** tab in Deployment Center
   - Watch for pull activity showing the new digest

### Method 2: Manual Image Update

If Method 1 doesn't work:

1. **Go to Deployment Center**
   - Same as above

2. **Update Settings**
   - Registry: Docker Hub
   - Repository: `scale112/pavan-client-backend`
   - Tag: `latest`
   - Click **Save**

3. **Force Pull**
   - Go to **Container settings** (left sidebar)
   - Enable **Continuous deployment**: ON
   - Click **Save**

4. **Restart App Service**
   - Go to **Overview** (left sidebar)
   - Click **Restart** button at the top
   - Wait 2-3 minutes

### Method 3: Azure CLI (If you have it installed)

```bash
# Restart the container and force pull
az webapp restart --name pavan-client-backend-bxgdaqhvarfdeuhe --resource-group <your-resource-group>

# Force sync
az webapp deployment container config --enable-cd true --name pavan-client-backend-bxgdaqhvarfdeuhe --resource-group <your-resource-group>
```

---

## Verify Deployment Success

### 1. Check Log Stream

**Azure Portal → Your App Service → Log stream**

**Look for these SUCCESS messages:**
```
[CouponService] ✅ Initialized with Supabase
[AutomationScheduler] ✅ Loaded 3 automation(s) from Supabase
Server running on port 8080
```

**Should NOT see:**
```
TypeError: CouponService is not a constructor
at file:///app/routes/payment.js:11:23
```

### 2. Check Container Logs

**Azure Portal → Your App Service → Containers**

Look for:
```
Pulling image: scale112/pavan-client-backend:latest
Successfully pulled image
Container started
```

### 3. Test Backend Health

```bash
# Check if backend responds
curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

# Should return 200 OK
```

### 4. Test Coupon Functionality

1. Go to admin dashboard
2. Create a test coupon
3. Refresh page - coupon should still be there ✅
4. Try payment with coupon - payment gateway should open ✅

---

## What This Fix Resolves

### Before (Old Image):
```javascript
// payment.js line 11 (OLD CODE)
import CouponService from '../services/couponService.js';
const couponService = new CouponService(); // ❌ CRASH - not a constructor
```

### After (New Image):
```javascript
// payment.js line 4 (NEW CODE)
import couponService from '../services/couponService.js'; // ✅ WORKS - singleton import
```

**Result**: Backend starts successfully, coupon endpoints work correctly.

---

## Timeline

**22 minutes ago**: Built and pushed new Docker image
**Now**: Need to force Azure to pull it

**Azure logs show**: Container restarts from 09:55 to 10:23, all with old image

**Action needed**: Force Azure to pull `sha256:c4f9654fec5b4e1a938bdcdd086dc9d6caeac8adfc20db43a3b280d86731242b`

---

## After Deployment: Test Multi-Profile Payment

Once the backend starts successfully, test the original issue:

1. **Single Profile + Coupon** (already working)
   - Select 1 profile
   - Add coupon code
   - Expected: Payment gateway opens ✅

2. **Multiple Profiles + Coupon** (was failing)
   - Select 2+ profiles
   - Add coupon code
   - Expected: Payment gateway should now open ✅

---

## Troubleshooting

### If logs still show constructor error:
- Azure hasn't pulled the new image
- Check Deployment Center → Logs for pull activity
- Try Method 2 (Manual Image Update) above

### If backend won't start:
- Check Log stream for specific error
- Verify environment variables are set (SUPABASE_URL, etc.)
- Check Configuration → Application settings

### If payment still fails with multiple profiles:
- Once backend starts successfully, share the new error logs
- The constructor issue is blocking us from diagnosing the actual payment logic

---

## Quick Deploy Commands

If you have the Azure Portal open:

1. Search bar → Type: `pavan-client-backend-bxgdaqhvarfdeuhe`
2. Click the App Service
3. Left sidebar → **Deployment Center**
4. Click **Redeploy** or **Restart**
5. Left sidebar → **Log stream**
6. Wait for: `[CouponService] ✅ Initialized with Supabase`

**Expected time**: 2-5 minutes for complete deployment

---

## Success Criteria

✅ No constructor errors in logs
✅ Backend starts without crashes
✅ Log stream shows Supabase initialization
✅ Coupon endpoints respond
✅ Payment gateway opens (single profile)
✅ Payment gateway opens (multiple profiles)

---

**Current Status**: 🟡 Image built and pushed, waiting for Azure deployment

**Next Step**: Go to Azure Portal and restart the App Service to pull the latest image

**ETA**: 5 minutes after restart
