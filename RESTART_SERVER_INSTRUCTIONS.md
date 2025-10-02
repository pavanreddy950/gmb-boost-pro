# Server Restart Instructions

## ✅ Critical Fix Applied: Coupon Persistence

The coupon system has been fixed! Coupons will now persist across server restarts.

## 🔄 You Must Restart the Server

The changes require a server restart to take effect. Follow these steps:

### Option 1: Using Terminal (Recommended)

**Stop the current server:**
1. Find the terminal/console window running your server
2. Press `Ctrl + C` to stop it
3. If needed, press `Ctrl + C` again to force stop

**Start the server again:**
```bash
cd server
npm run dev:local
```

**Or if you prefer to run both frontend and backend:**

In terminal 1 (Backend):
```bash
cd server
npm run dev:local
```

In terminal 2 (Frontend):
```bash
npm run dev:local
```

### Option 2: Using Task Manager (Windows)

1. Open Task Manager (`Ctrl + Shift + Esc`)
2. Find all `node.exe` processes
3. Right-click each one and select "End Task"
4. Restart using the commands above

### ✅ Verify the Fix Works

After restarting, you should see this in the server logs:
```
[CouponService] Loaded 1 coupons from file
```

This confirms coupons are being loaded from persistent storage!

## 🧪 Test the Coupon System

### Step 1: Create a Test Coupon

1. Go to Admin Panel → Coupons
2. Click "Create Coupon"
3. Fill in:
   - **Code:** `TEST50`
   - **Type:** Percentage
   - **Value:** `50`
   - **Max Uses:** `10`
   - **Description:** `50% off test coupon`
4. Click "Create Coupon"

**Expected:** You should see success message and the coupon in the list showing as **Active** (green badge)

### Step 2: Verify Persistence

After creating the coupon, check the server logs for:
```
[CouponService] Created coupon: TEST50
[CouponService] Saved 2 coupons to file
```

Then open `server/data/coupons.json` to verify it contains:
- RAJATEST (the test coupon)
- TEST50 (your new coupon)

### Step 3: Test Coupon Application

1. Go to Billing page
2. Select a plan
3. Enter coupon code: `TEST50`
4. Click "Apply"

**Expected:** 
- ✅ "Coupon Applied!" success message
- ✅ Price reduced by 50%
- ✅ Server logs: `[CouponService] Applied coupon TEST50: $X → $Y`

### Step 4: Test Persistence After Restart

1. **Restart the server again** (Ctrl+C and restart)
2. Check server logs for: `[CouponService] Loaded 2 coupons from file`
3. Go to Admin Panel → Coupons
4. **Verify TEST50 is still there** (it should show up!)
5. Try applying TEST50 again in billing

**Expected:** Everything works! The coupon persists across restarts!

## 📋 What Was Fixed

### Before (Broken):
- ❌ Coupons stored in memory only
- ❌ Lost on server restart
- ❌ Only RAJATEST persisted (hardcoded)
- ❌ Admin-created coupons disappeared

### After (Fixed):
- ✅ Coupons saved to `server/data/coupons.json`
- ✅ Persist across server restarts
- ✅ All coupons loaded on startup
- ✅ Usage counts and tracking saved
- ✅ One-time per user restrictions persist

## 🐛 Troubleshooting

### Issue: "Coupons still not working"

**Solution:**
1. Ensure you restarted the server completely
2. Check server logs for `[CouponService] Loaded X coupons from file`
3. Verify `server/data/coupons.json` exists
4. Check file permissions on the `server/data/` directory

### Issue: "Cannot find module" error

**Solution:**
```bash
cd server
npm install
npm run dev:local
```

### Issue: Server won't start

**Solution:**
1. Kill all Node.js processes
2. Delete `node_modules` folder
3. Run `npm install` again
4. Try starting server again

## 📝 Console Logs to Watch For

When the server starts successfully, you'll see:
```
[CouponService] Loaded 1 coupons from file
Server running on port 5000
```

When you create a coupon:
```
[CouponService] Created coupon: CODE
[CouponService] Saved X coupons to file
```

When you apply a coupon:
```
[Payment Route] Applying coupon: CODE
[CouponService] Applied coupon CODE: $X → $Y
[CouponService] Saved X coupons to file
```

## ✨ New Features Now Working

1. **Persistent Coupons** - Survive server restarts
2. **Usage Tracking** - Usage counts are saved and tracked
3. **One-Time Per User** - User restrictions persist across sessions
4. **Audit Trail** - All coupon actions logged
5. **Admin Panel** - Full CRUD operations on coupons
6. **Real-Time Billing** - Coupons apply immediately

## 🎉 You're All Set!

Once you restart the server, create a test coupon, and verify it persists, your coupon system is fully functional!


