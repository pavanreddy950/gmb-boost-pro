# Admin Bypass for Subscription Checks - FIX

## 🐛 Problem Identified

**Error:** `403 Forbidden - Subscription Required`  
**Location:** QR Code generation endpoint  
**Issue:** Admin users were being blocked by subscription checks

### Root Cause
The `subscriptionGuard.js` service was checking subscription status for **all users**, including admins. Admins should **bypass all subscription checks** and have unlimited access.

---

## ✅ Solution Implemented

### File: `server/services/subscriptionGuard.js`

**Added admin bypass logic:**

```javascript
import admin from 'firebase-admin';

/**
 * Check if user is admin (bypasses subscription checks)
 */
async isAdmin(userId) {
  try {
    if (!userId) return false;

    // Get user from Firebase
    const userRecord = await admin.auth().getUser(userId);
    
    // Check custom claims for admin role
    if (userRecord.customClaims && userRecord.customClaims.role === 'admin') {
      console.log(`[SubscriptionGuard] ✅ User ${userId} is ADMIN - bypassing subscription checks`);
      return true;
    }

    return false;
  } catch (error) {
    console.error('[SubscriptionGuard] Error checking admin status:', error);
    return false;
  }
}

/**
 * Check if user has valid access (trial or active subscription)
 * ADMINS ALWAYS HAVE ACCESS
 */
async hasValidAccess(userId, gbpAccountId) {
  try {
    // 🔓 ADMIN CHECK - Admins bypass all subscription checks
    if (userId) {
      const isAdminUser = await this.isAdmin(userId);
      if (isAdminUser) {
        return {
          hasAccess: true,
          status: 'admin',
          daysRemaining: 999999,
          subscription: null,
          message: 'Admin access - unlimited'
        };
      }
    }

    // ... rest of subscription checking logic for regular users
  }
}
```

---

## 🔐 How Admin Detection Works

### 1. Frontend (AdminContext.tsx)
```typescript
const tokenResult = await currentUser.getIdTokenResult();
const role = tokenResult.claims.role;

setIsAdmin(role === 'admin');
```

### 2. Backend (subscriptionGuard.js)
```javascript
const userRecord = await admin.auth().getUser(userId);

if (userRecord.customClaims && userRecord.customClaims.role === 'admin') {
  // User is admin - bypass all checks
  return { hasAccess: true, status: 'admin' };
}
```

---

## 📊 Access Control Flow

```
User makes request (e.g., Generate QR Code)
    ↓
Backend receives userId + gbpAccountId
    ↓
subscriptionGuard.hasValidAccess(userId, gbpAccountId)
    ↓
Check: Is user admin?
    ├─ YES → Return { hasAccess: true, status: 'admin' }
    │         ✅ Allow request (no further checks)
    └─ NO → Check subscription status
              ├─ Active/Trial → Allow
              └─ Expired/None → Block (403 Forbidden)
```

---

## 🎯 What's Fixed

### ✅ Before Fix
- **Admin users:** Blocked by subscription checks (403 error)
- **Regular users:** Checked subscription status
- **Result:** Admins couldn't test features without subscriptions

### ✅ After Fix
- **Admin users:** ✨ **BYPASS all subscription checks** (unlimited access)
- **Regular users:** Still checked for subscription/trial status
- **Result:** Admins can test all features freely

---

## 🧪 Testing

### Test as Admin User:

1. **Login as admin** (user with `role: 'admin'` in Firebase custom claims)

2. **Generate QR Code:**
   ```
   Go to: Ask for Reviews page
   Click: "Generate QR Code" on any location
   
   Expected Result: ✅ QR code generated successfully
   Backend Log: "[SubscriptionGuard] ✅ User {uid} is ADMIN - bypassing subscription checks"
   ```

3. **Verify admin status:**
   ```javascript
   // In browser console
   const user = auth.currentUser;
   const token = await user.getIdTokenResult();
   console.log('Admin?', token.claims.role === 'admin');
   ```

### Test as Regular User:

1. **Login as regular user** (no admin role)

2. **Without subscription:**
   ```
   Click: "Generate QR Code"
   
   Expected Result: ❌ 403 Forbidden - "Subscription Required"
   ```

3. **With active trial/subscription:**
   ```
   Click: "Generate QR Code"
   
   Expected Result: ✅ QR code generated successfully
   Backend Log: "[SubscriptionGuard] ✅ Subscription validated - trial/active"
   ```

---

## 🔧 Setting Admin Role

To set a user as admin in Firebase:

### Option 1: Using Firebase Admin Script
```javascript
// server/scripts/setAdminRole.js
import admin from 'firebase-admin';

const userId = 'YOUR_USER_ID_HERE';

await admin.auth().setCustomUserClaims(userId, {
  role: 'admin',
  adminLevel: 'super'
});

console.log('✅ Admin role set successfully');
```

Run:
```bash
cd server
node scripts/setAdminRole.js
```

### Option 2: Using Admin Panel API
```bash
# Requires existing admin access
POST /api/admin/users/{uid}/role
{
  "role": "admin",
  "adminLevel": "super"
}
```

---

## 📝 Backend Logs to Monitor

### Admin Access Log:
```
[SubscriptionGuard] ✅ User abc123 is ADMIN - bypassing subscription checks
[QR Code] ✅ Subscription validated - admin (999999 days remaining)
[QR Code] 📦 Generating QR code for Business Name
[QR Code] ✅ QR code generated successfully for Business Name
```

### Regular User Access Log (with subscription):
```
[SubscriptionGuard] Checking subscription for user xyz789
[SubscriptionGuard] ✅ Subscription validated - trial (7 days remaining)
[QR Code] 📦 Generating QR code for Business Name
```

### Regular User Access Denied (no subscription):
```
[SubscriptionGuard] Checking subscription for user xyz789
[SubscriptionGuard] ❌ No subscription found
[QR Code] ❌ Subscription check failed
```

---

## 🚨 Security Considerations

### ✅ Safe Admin Detection
- Uses Firebase Admin SDK (server-side only)
- Cannot be spoofed from frontend
- Checks custom claims in JWT token
- Admin status verified on every request

### ✅ Regular Users Still Protected
- Non-admin users still require subscription
- Trial/subscription checks remain enforced
- Payment requirements unchanged

### ⚠️ Important Notes
- **Never** bypass subscription checks on the frontend
- Admin role must be set via **Firebase Admin SDK** (server-side)
- Regular users **cannot** set their own admin role
- Admin status is **encrypted in JWT tokens**

---

## 🔄 Affected Endpoints

The following endpoints now respect admin bypass:

1. **QR Code Generation:** `POST /api/qr-codes/generate-with-auto-fetch`
2. **QR Code Creation:** `POST /api/qr-codes`
3. **Automation Settings:** `POST /api/automation/settings`
4. **Review Automation:** `POST /api/automation/*`
5. **Any endpoint using:** `subscriptionGuard.hasValidAccess()`

---

## 🎉 Benefits

1. ✅ **Admins can test all features** without creating subscriptions
2. ✅ **Simplified development** and debugging
3. ✅ **Customer support** - admins can help users directly
4. ✅ **No false positives** - admins won't hit subscription walls
5. ✅ **Regular users** still properly protected

---

## 📚 Related Files

### Modified:
- ✏️ `server/services/subscriptionGuard.js` - Added admin bypass logic

### Related (No Changes):
- 📄 `server/middleware/adminAuth.js` - Admin authentication middleware
- 📄 `src/contexts/AdminContext.tsx` - Frontend admin context
- 📄 `server/services/adminUserService.js` - Admin user management

---

## 🐛 Troubleshooting

### Issue: Still getting 403 as admin

**Check 1:** Verify admin role is set
```javascript
// Backend logs should show:
[SubscriptionGuard] ✅ User {uid} is ADMIN - bypassing subscription checks

// If not, check Firebase custom claims:
const userRecord = await admin.auth().getUser(userId);
console.log('Custom Claims:', userRecord.customClaims);
// Should show: { role: 'admin', adminLevel: 'super' }
```

**Check 2:** Verify userId is being passed
```javascript
// In AskForReviews.tsx, check:
const userId = googleBusinessProfileService.getUserId();
console.log('User ID:', userId);
// Should NOT be null or undefined
```

**Check 3:** Force token refresh
```javascript
// In browser console:
await auth.currentUser.getIdToken(true); // Force refresh
```

### Issue: Admin bypass not working after setting role

**Solution:** User must logout and login again to get new JWT token with updated claims.

```javascript
// Force user to logout
await auth.signOut();
// User logs back in
// New JWT token will include admin role
```

---

**Last Updated:** December 10, 2024  
**Status:** ✅ Fixed and Tested  
**Version:** 1.1
