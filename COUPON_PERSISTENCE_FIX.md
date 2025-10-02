# Coupon Persistence Fix

## Date: October 1, 2025

## Critical Issue Found

### Problem
**Coupons were failing because they were stored in memory only!**

The `CouponService` was using a JavaScript `Map` to store coupons in memory, which meant:
- ❌ When the server restarted, all created coupons were lost
- ❌ Only the hardcoded `RAJATEST` coupon persisted (because it was in the constructor)
- ❌ Any coupons created through the admin panel disappeared on server restart
- ❌ This is why coupons appeared to be "failing" - they literally didn't exist after restart

### Solution Implemented

**Created a persistent file-based coupon storage system:**

1. **Created `server/data/coupons.json`** - Persistent storage for all coupons
2. **Updated `CouponService`** to:
   - Load coupons from file on server startup
   - Save coupons to file whenever they are:
     - Created
     - Modified
     - Deactivated
     - Used (to track usage count)

### Changes Made

#### File: `server/services/couponService.js`

**Added:**
```javascript
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

class CouponService {
  constructor() {
    this.couponsFile = path.join(__dirname, '../data/coupons.json');
    this.coupons = new Map();
    this.loadCoupons(); // Load from file on startup
  }

  loadCoupons() {
    // Loads all coupons from coupons.json
    // Converts date strings back to Date objects
  }

  saveCoupons() {
    // Saves all coupons to coupons.json
    // Converts Date objects to ISO strings for JSON
  }
}
```

**Modified Methods:**
- `createCoupon()` - Now calls `this.saveCoupons()` after creating
- `deactivateCoupon()` - Now calls `this.saveCoupons()` after deactivating
- `applyCoupon()` - Now calls `this.saveCoupons()` after tracking usage

#### File: `server/data/coupons.json` (NEW)

Initial content with the test coupon:
```json
{
  "RAJATEST": {
    "code": "RAJATEST",
    "discount": 100,
    "type": "percentage",
    "active": true,
    "isActive": true,
    "maxUses": 10000,
    "usedCount": 0,
    "currentUses": 0,
    "description": "Internal testing - Pay only ₹1",
    "validUntil": "2030-12-31T00:00:00.000Z",
    "expiresAt": "2030-12-31T00:00:00.000Z",
    "hidden": true,
    "oneTimePerUser": false,
    "usedBy": [],
    "createdAt": "2025-01-01T00:00:00.000Z"
  }
}
```

### How It Works Now

1. **Server Starts:**
   - `CouponService` loads `coupons.json`
   - All existing coupons are loaded into memory
   - Console logs: `[CouponService] Loaded X coupons from file`

2. **Admin Creates Coupon:**
   - Coupon is added to memory Map
   - **Immediately saved to `coupons.json`**
   - Console logs: `[CouponService] Created coupon: CODE`
   - Console logs: `[CouponService] Saved X coupons to file`

3. **User Applies Coupon:**
   - Coupon is validated and applied
   - Usage count is incremented
   - **Changes saved to `coupons.json`**
   - Console logs: `[CouponService] Applied coupon CODE: $X → $Y`
   - Console logs: `[CouponService] Saved X coupons to file`

4. **Server Restarts:**
   - All coupons are loaded from `coupons.json`
   - **No coupons are lost!**
   - All usage counts and user tracking persists

### Benefits

✅ **Persistent Storage** - Coupons survive server restarts
✅ **Usage Tracking** - Coupon usage counts are saved
✅ **User Tracking** - One-time per user restrictions persist
✅ **Audit Trail** - File-based storage provides audit trail
✅ **Backup Friendly** - Easy to backup with other data files
✅ **No Database Required** - Simple JSON file storage

### Testing

**To verify the fix works:**

1. **Restart the server:**
   ```bash
   cd server
   npm run dev:local
   ```

2. **Check server logs** for:
   ```
   [CouponService] Loaded 1 coupons from file
   ```

3. **Create a test coupon** in admin panel:
   - Code: `TEST50`
   - Type: Percentage
   - Value: 50
   - Max Uses: 10
   
4. **Check server logs** for:
   ```
   [CouponService] Created coupon: TEST50
   [CouponService] Saved 2 coupons to file
   ```

5. **Verify the coupon was saved:**
   - Open `server/data/coupons.json`
   - You should see both RAJATEST and TEST50

6. **Restart the server again** and check:
   ```
   [CouponService] Loaded 2 coupons from file
   ```

7. **Try applying the coupon** in billing:
   - It should work immediately
   - Check server logs for successful application

8. **Verify coupon persistence:**
   - Check `server/data/coupons.json` again
   - Usage count should be incremented

### Important Notes

⚠️ **Server Restart Required**
The fix requires restarting the Node.js server to load the new code:
```bash
# Stop the current server (Ctrl+C)
cd server
npm run dev:local
```

⚠️ **Existing Coupons**
Any coupons created before this fix were lost (they were only in memory). You'll need to recreate them through the admin panel.

⚠️ **File Permissions**
Ensure the server has write permissions to `server/data/` directory.

### Console Logging

The service now provides detailed logging for debugging:
- `[CouponService] Loaded X coupons from file`
- `[CouponService] Created coupon: CODE`
- `[CouponService] Saved X coupons to file`
- `[CouponService] Applied coupon CODE: $X → $Y`
- `[CouponService] Deactivated coupon: CODE`

### Data Structure

Each coupon in `coupons.json` contains:
```json
{
  "CODE": {
    "code": "CODE",
    "discount": 50,
    "type": "percentage",
    "active": true,
    "isActive": true,
    "maxUses": 100,
    "usedCount": 0,
    "currentUses": 0,
    "description": "50% off special",
    "validUntil": "2025-12-31T00:00:00.000Z",
    "expiresAt": "2025-12-31T00:00:00.000Z",
    "hidden": false,
    "oneTimePerUser": true,
    "usedBy": ["user123", "user456"],
    "createdAt": "2025-10-01T12:00:00.000Z"
  }
}
```

## Summary

**Root Cause:** Coupons were stored in memory only, lost on server restart
**Solution:** Implemented persistent file-based storage in `coupons.json`
**Status:** ✅ Fixed and ready to test
**Action Required:** Restart the server to apply changes


