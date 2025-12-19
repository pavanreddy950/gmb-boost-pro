# 🚨 URGENT FIX: 91 Profiles Bug

## What Happened

You paid for **1 profile** but the system gave you **91 profiles**.

### Root Cause
The payment verification code had a critical bug:
- When you had a **trial subscription with 90 profiles**, the system stored `profileCount = 90`
- When you **paid for 1 profile**, the code incorrectly did: `90 + 1 = 91`
- **The bug**: It was treating trial profiles as if they were paid profiles

### The Exact Bug (Fixed)
```javascript
// ❌ BEFORE (BUGGY CODE):
const currentPaidSlots = subscription.paidSlots || subscription.profileCount || 0;
// This used trial profileCount (90) instead of paidSlots (0)

// ✅ AFTER (FIXED CODE):
const currentPaidSlots = subscription.paidSlots || 0;
// Only uses actual paid slots, never trial profileCount
```

---

## IMMEDIATE FIX (Fix Your Subscription Now)

### Option 1: Quick Manual Fix (RECOMMENDED - 2 minutes)

1. **Edit the fix script:**
   ```bash
   cd server
   ```

2. **Open `quick-fix-my-subscription.js` in your editor**

3. **Edit these two lines:**
   ```javascript
   const YOUR_EMAIL = 'your-actual-email@example.com'; // ← Put your real email here
   const CORRECT_PROFILE_COUNT = 1; // ← How many profiles did you pay for?
   ```

4. **Run the fix:**
   ```bash
   node quick-fix-my-subscription.js
   ```

5. **Refresh your browser** - you should now see 1 profile instead of 91

---

### Option 2: Automatic Fix (If you have multiple affected users)

```bash
cd server
node fix-profile-count-bug.js
```

This will scan all subscriptions and fix any that have the bug.

---

## PERMANENT FIX (Prevent This From Happening Again)

The code has been fixed in `server/routes/payment.js`. To apply the fix:

### 1. Restart Your Backend Server

**If running locally:**
```bash
cd server
# Stop the server (Ctrl+C)
npm run dev
```

**If deployed on Azure:**
```bash
cd server
# Deploy the updated code
./deploy-with-fixes.bat
```

### 2. Verify the Fix

The logs will now show:
```
[Payment Verify] 💰 FIRST PAYMENT - Setting paidSlots:
   previousStatus: trial
   currentPaidSlots: 0
   profilesPurchased: 1
   newPaidSlots: 1
   action: SET (not add)  ← This confirms it's not adding to trial count
```

---

## What Changed in the Code

### Two Places Fixed:

1. **Regular Payment Verification** (`server/routes/payment.js` line 564-589)
2. **Subscription Payment Verification** (`server/routes/payment.js` line 1147-1175)

### The Fix Logic:

```javascript
// Detect if this is the FIRST payment (trial → paid transition)
const isFirstPayment = subscription.status === 'trial' || !subscription.paidSlots;

if (isFirstPayment) {
  // SET paid slots to what user purchased (don't add to trial count!)
  newPaidSlots = profileCountFromNotes; // 1 profile = 1 paidSlot
} else {
  // Only ADD if it's a top-up payment (user already paid and buying more)
  newPaidSlots = currentPaidSlots + profileCountFromNotes;
}
```

---

## How to Test

1. **Create a new test account**
2. **Connect 50 profiles during trial** (to simulate the original issue)
3. **Pay for 1 profile**
4. **Verify you get ONLY 1 paid slot** (not 51)

Expected logs:
```
✅ FIRST PAYMENT - Setting paidSlots: 1
❌ NOT: Adding 50 + 1 = 51
```

---

## Impact

- ✅ **Existing users**: Need to run the fix script manually
- ✅ **Future payments**: Will work correctly with the code fix
- ✅ **Top-up payments**: Will still work (adding more profiles after first payment)

---

## Questions?

If you have any issues running the fix scripts or need help, let me know!

**The bug is FIXED in the code, you just need to:**
1. ✅ Run the quick fix script to correct your current subscription
2. ✅ Restart your backend server to apply the code changes
