# RAJATEST Coupon Bug Report

## Issue Summary
When users pay with the RAJATEST coupon (₹1 test payment), the order notes are empty in Razorpay, causing the `profileCount` to not be saved. This results in users having `profile_count = 1` or `NULL` in the database even if they selected 10+ profiles during checkout.

## Evidence
- Payment ID: `pay_Rm3Lq24yuvCC7z` (Dec 1, 2025)
- Order ID: `order_Rm3LfvbhG0owaC`
- Amount: ₹1 (RAJATEST coupon applied)
- Order Notes: `[]` (EMPTY - should contain `profileCount`)
- User selected: 10+ profiles
- Database showed: `profile_count = 1`

## Root Cause Analysis

### What We Know:
1. **Backend code is correct**: The `/api/payment/order` endpoint correctly passes notes from request body to Razorpay
   - File: `server/routes/payment.js`, line 362
   - Code: `paymentService.createOrder(finalAmount, currency, notes)`

2. **PaymentService is correct**: The service spreads incoming notes correctly
   - File: `server/services/paymentService.js`, lines 86-90
   - Code: Spreads `...notes` and adds additional fields

3. **Only one frontend component calls `/api/payment/order`**: TrialSetupModal.tsx
   - Lines 79-95 show profileCount being sent in notes
   - But user payment has empty notes

### Hypothesis:
The bug occurs when users initiate payment with RAJATEST coupon through an **unknown payment flow** that we haven't identified yet, OR there's a condition where notes are not being sent from the frontend.

## Impact
- **High**: Affects all test payments with RAJATEST coupon
- Users pay for X profiles but only get access to 1 profile
- Requires manual database fix for each affected user

## Temporary Fix Applied
Created `server/fix-profile-count.js` to manually update subscription:
- Updates `profile_count` and `plan_id` fields
- User: eWw8jjayQcSKN8uk9GLyNg49lMn2
- GBP Account: 104728397456701856554
- Set profile_count to 10

## Recommended Permanent Fixes

### Fix #1: Add Server-Side Validation
**File**: `server/routes/payment.js`
**Location**: Line ~300 (in `/order` endpoint)

Add validation to ensure profileCount is present:

```javascript
const {
  amount,
  currency = 'INR',
  notes = {},
  couponCode,
  usdAmount
} = req.body;

// VALIDATION: Ensure critical fields are in notes
if (!notes.profileCount && !notes.actualProfileCount) {
  console.warn('[Payment Route] ⚠️ WARNING: profileCount missing from notes!');
  console.warn('[Payment Route] Request body:', JSON.stringify(req.body, null, 2));

  // Option 1: Reject the payment
  // return res.status(400).json({
  //   error: 'Profile count is required in order notes'
  // });

  // Option 2: Default to 1 profile
  notes.profileCount = 1;
  console.warn('[Payment Route] Defaulting to profileCount = 1');
}
```

### Fix #2: Add Comprehensive Logging
**File**: `server/routes/payment.js`
**Location**: Line ~290 (start of `/order` endpoint)

Add detailed logging:

```javascript
router.post('/order', async (req, res) => {
  try {
    console.log('[Payment Route] ========================================');
    console.log('[Payment Route] Creating order with FULL body:', JSON.stringify(req.body, null, 2));
    console.log('[Payment Route] ========================================');

    // ... existing code ...
```

### Fix #3: Verify Payment Flow on Frontend
**Action**: Audit all places where payments are initiated

1. Search for all `fetch(...'/api/payment/order'...)` calls
2. Ensure ALL calls include `profileCount` in notes
3. Add frontend validation before payment:

```typescript
// Before calling /api/payment/order
if (!profileCount || profileCount < 1) {
  toast({
    title: "Error",
    description: "Please select the number of profiles",
    variant: "destructive"
  });
  return;
}
```

### Fix #4: Database Constraint
**File**: `server/database/schema.sql`
**Action**: Add default value for profile_count

```sql
ALTER TABLE subscriptions
ALTER COLUMN profile_count SET DEFAULT 1;

-- Add check constraint
ALTER TABLE subscriptions
ADD CONSTRAINT profile_count_positive CHECK (profile_count >= 1);
```

### Fix #5: Payment Verification Enhancement
**File**: `server/routes/payment.js`
**Location**: `/verify` endpoint (around line 450)

When verifying payment, check if profileCount was saved:

```javascript
// After fetching order from Razorpay
const order = await razorpay.orders.fetch(razorpay_order_id);

// Check if notes are empty
if (!order.notes || Object.keys(order.notes).length === 0) {
  console.error('[Payment Verify] ❌ Order has EMPTY notes!');
  console.error('[Payment Verify] Order ID:', razorpay_order_id);
  // Alert admin or log to monitoring system
}

// Extract profile count with fallback
const profileCount = parseInt(
  order.notes?.profileCount ||
  order.notes?.actualProfileCount ||
  1 // Default to 1 if missing
);
```

## Testing Recommendations

1. **Create test case**: Test payment flow with RAJATEST coupon
2. **Verify notes**: After creating order, fetch it from Razorpay and verify notes
3. **Add monitoring**: Alert when orders are created with empty notes
4. **User acceptance test**: Have a test user go through the full payment flow with RAJATEST

## Prevention Checklist

- [ ] Add backend validation for profileCount in notes
- [ ] Add comprehensive logging for all payment requests
- [ ] Audit all frontend payment flows
- [ ] Add frontend validation before payment
- [ ] Add database constraints
- [ ] Enhance payment verification with notes check
- [ ] Create automated tests for RAJATEST flow
- [ ] Add monitoring/alerts for empty notes

## Related Files
- `server/routes/payment.js` - Payment order creation
- `server/services/paymentService.js` - Razorpay integration
- `server/services/couponService.js` - Coupon application
- `src/components/TrialSetupModal.tsx` - Trial payment flow
- `src/components/PaymentModal.tsx` - Subscription payment flow
- `server/fix-profile-count.js` - Manual fix script (temporary)

## Status
- [x] Issue identified
- [x] Temporary fix applied for affected user
- [ ] Permanent fix implemented
- [ ] Testing completed
- [ ] Deployed to production
