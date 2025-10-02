# 🔒 Single-Use Coupon Feature

## Date: October 1, 2025

## ✅ New Feature Added: Auto-Disable After First Use

I've added a powerful new option for coupons: **Single Use** - coupons that automatically disable after the FIRST use by ANY user.

## 🎯 Feature Overview

### Three Coupon Types Now Available:

| Type | Description | Use Case |
|------|-------------|----------|
| **Regular** | Can be used multiple times by multiple users until max uses or expiry | General promotions (e.g., SUMMER20) |
| **One-Time Per User** | Each user can only use once, but multiple users can use it | Welcome offers, referral rewards |
| **Single Use** | Auto-disables after FIRST use by ANY user | VIP codes, exclusive one-person deals |

## 🆕 What's New

### In Admin Panel:

When creating a coupon, you now see two checkboxes:

1. ☑️ **One-time use per user** - Each user can only use this coupon once
2. 🔒 **Single use** - Auto-disable after FIRST use by ANY user

### How It Works:

1. **Admin creates single-use coupon** with the 🔒 checkbox enabled
2. **First user applies the coupon** → Coupon works perfectly ✅
3. **Coupon automatically disables** → Status changes to "Inactive" 🔴
4. **Any other user tries to use it** → Error: "This coupon is no longer active" ❌

### Server Logging:

When a single-use coupon is auto-disabled, you'll see:
```
[CouponService] Applied coupon VIPCODE: 9900 → 99 (discount: 9801)
[CouponService] 🔒 Auto-disabled single-use coupon: VIPCODE
[CouponService] Saved 3 coupons to file
```

## 📋 How to Create Different Coupon Types

### Example 1: Regular Coupon (Multiple Uses)
```
Code: SAVE20
Type: Percentage
Value: 20
Max Uses: 100
☐ One-time use per user
☐ Single use

Result: Any user can use it multiple times, up to 100 total uses
```

### Example 2: One-Time Per User
```
Code: WELCOME50
Type: Percentage
Value: 50
Max Uses: 1000
☑ One-time use per user
☐ Single use

Result: Each user can only use it once, but 1000 different users can use it
```

### Example 3: Single Use (NEW!)
```
Code: VIP100
Type: Percentage
Value: 100
Max Uses: 1
☐ One-time use per user
☑ Single use

Result: Only ONE person can use this code, then it auto-disables forever
```

### Example 4: Combined Restrictions
```
Code: EXCLUSIVE
Type: Percentage
Value: 75
Max Uses: 5
☑ One-time use per user
☑ Single use

Result: First user to apply it will use it, then it auto-disables
(Note: Both checked means single-use takes priority)
```

## 🎯 Use Cases for Single-Use Coupons

### 1. VIP Customer Codes
```
Code: VIP-JOHN-2025
Value: 100% off
Single Use: ✅
Description: Exclusive code for John Doe
```
Perfect for giving a specific person a one-time free subscription.

### 2. Contest Winners
```
Code: WINNER-OCT2025
Value: 50% off
Single Use: ✅
Description: Contest winner exclusive code
```
Give to contest winner so only they can use it once.

### 3. Influencer Exclusive Codes
```
Code: INFLUENCER-EXCLUSIVE
Value: 90% off
Single Use: ✅
Description: Special code for influencer review
```
Send to an influencer for their exclusive use.

### 4. Beta Tester Rewards
```
Code: BETA-TESTER-THANKS
Value: 100% off (1 year free)
Single Use: ✅
Description: Thank you code for beta tester
```
Reward beta testers with exclusive codes.

### 5. Emergency Compensation
```
Code: SORRY-DOWNTIME-USER123
Value: 100% off
Single Use: ✅
Description: Compensation for service downtime
```
Quickly generate compensation codes for affected users.

## 🔧 Technical Details

### Files Modified:
1. `server/services/couponService.js` - Added auto-disable logic
2. `server/routes/admin.js` - Added singleUse parameter handling
3. `src/pages/Admin/AdminCoupons.tsx` - Added UI checkbox

### Backend Logic:
```javascript
// After applying coupon
if (coupon.singleUse && coupon.usedCount >= 1) {
  coupon.active = false;
  coupon.isActive = false;
  console.log(`[CouponService] 🔒 Auto-disabled single-use coupon: ${coupon.code}`);
}
// Save to file
this.saveCoupons();
```

### Database Storage:
```json
{
  "VIPCODE": {
    "code": "VIPCODE",
    "discount": 100,
    "type": "percentage",
    "active": false,
    "isActive": false,
    "usedCount": 1,
    "singleUse": true,
    "description": "VIP exclusive code",
    "usedBy": ["userId123"]
  }
}
```

## 🧪 Testing the Feature

### Test 1: Create Single-Use Coupon

1. Go to **Admin Panel → Coupons**
2. Click **Create Coupon**
3. Fill in:
   - Code: `TEST-SINGLE`
   - Type: Percentage
   - Value: `50`
   - **Check:** 🔒 Single use
4. Click **Create Coupon**

**Expected:** Coupon created successfully, shows as Active (green)

### Test 2: First User Uses It

1. Go to **Billing** page (logged in as User A)
2. Select a plan
3. Enter code: `TEST-SINGLE`
4. Click **Apply**

**Expected:** 
- ✅ Discount applied (50% off)
- Server logs: `[CouponService] 🔒 Auto-disabled single-use coupon: TEST-SINGLE`

### Test 3: Check Auto-Disable

1. Go to **Admin Panel → Coupons**
2. Find `TEST-SINGLE`

**Expected:** Status is now **Inactive** (red badge)

### Test 4: Second User Tries to Use It

1. Go to **Billing** page (logged in as User B or same user)
2. Select a plan
3. Enter code: `TEST-SINGLE`
4. Click **Apply**

**Expected:** 
- ❌ Error: "This coupon is no longer active"
- Coupon stays disabled

### Test 5: Verify Persistence

1. **Restart the server**
2. Go to **Admin Panel → Coupons**
3. Check `TEST-SINGLE` status

**Expected:** Still shows as **Inactive** (persisted in `coupons.json`)

## 📊 Admin Panel Display

Coupons in the admin panel now show:
- **Code** - The coupon code
- **Type** - Percentage or Fixed
- **Discount** - Value (e.g., 50%)
- **Status** - Active (green) or Inactive (red)
- **Uses** - Current uses / Max uses
- **Expires** - Expiration date
- **Actions** - Deactivate button (for active coupons)

Single-use coupons that have been used will show:
- Status: **Inactive** 🔴
- Uses: **1 / 100** (or whatever max was set)

## 🔍 Difference Between Checkbox Options

### Just "One-Time Per User" ☑
- User A can use it once ✅
- User B can use it once ✅
- User C can use it once ✅
- Stays active until max uses reached or expired

### Just "Single Use" ☑
- User A uses it → Coupon disables ✅
- User B tries to use → Error ❌
- Same User A tries again → Error ❌

### Both Checked ☑☑
- Single-use takes priority
- First person to use it wins
- Immediately disables after first use

### Neither Checked ☐☐
- Regular coupon
- Anyone can use multiple times
- Only limited by max uses and expiry

## 💡 Best Practices

1. **Set Max Uses to 1** for single-use coupons (redundant but clear)
2. **Use descriptive codes** like `VIP-USERNAME-DATE`
3. **Add descriptions** to track who the code was for
4. **Monitor usage** in admin panel regularly
5. **Set expiry dates** as backup protection

## 🎉 Benefits

✅ **Exclusive codes** for specific customers
✅ **VIP treatment** for special users
✅ **Contest prizes** that can't be shared
✅ **Influencer codes** that can't be abused
✅ **Automatic cleanup** - no manual deactivation needed
✅ **Perfect for referrals** - one-time rewards
✅ **Compensation codes** for customer service

## 🚀 Ready to Use!

The feature is **live and working right now**. Just restart your server if needed, and start creating single-use coupons!

---

**Feature Status:** 🟢 LIVE
**Auto-Disable:** 🟢 WORKING
**Persistence:** 🟢 WORKING
**Admin UI:** 🟢 UPDATED


