# Slot-Based Subscription System

## Overview

This document explains the slot-based subscription system implemented to handle dynamic profile additions and deletions without subscription mismatches.

## Problem Statement

Previously, when users added or deleted Google Business Profiles:
- The system would charge for ALL profiles again when a new profile was added
- When profiles were deleted, the subscription count would decrease incorrectly
- Users lost their paid subscription slots when they deleted profiles

## Solution: Slot-Based Subscription Model

### Key Concepts

1. **Paid Slots (`paidSlots`)**: Total number of profile slots the user has PAID for during their subscription period (1 year)
   - This number NEVER decreases during the subscription period
   - Only increases when user makes additional payments

2. **Active Profiles (`profileCount`)**: Current number of profiles in the user's Google Business Profile account
   - This number can increase or decrease as user adds/deletes profiles
   - Automatically tracked and updated when profiles change

### How It Works

#### Scenario 1: Initial Payment
```
User pays for 10 profiles
✅ paidSlots = 10
✅ profileCount = 10
→ User can manage up to 10 profiles for 1 year
```

#### Scenario 2: Adding 11th Profile
```
User adds an 11th profile to their GBP account
🔍 System detects: profileCount (11) > paidSlots (10)
💰 Payment required for ONLY 1 additional profile
✅ After payment:
   - paidSlots = 11 (10 + 1)
   - profileCount = 11
```

#### Scenario 3: Deleting Profiles
```
User deletes 3 profiles (now has 8 profiles)
✅ paidSlots STAYS at 11 (they paid for the year!)
✅ profileCount = 8
📊 User has 3 unused slots
→ No refund, but user can add 3 more profiles without payment
```

#### Scenario 4: Adding Profile Within Paid Slots
```
User adds a 9th profile (they have 11 paid slots)
🔍 System detects: profileCount (9) < paidSlots (11)
✅ NO payment needed! User has 2 unused slots
✅ profileCount = 9
✅ paidSlots = 11 (unchanged)
```

## Database Schema

### New Fields in `subscriptions` Table

```sql
-- Total slots the user has paid for (never decreases during subscription)
paid_slots INTEGER DEFAULT 0

-- Array of location IDs that have been paid for
paid_location_ids TEXT[] DEFAULT '{}'

-- Current number of active profiles (can increase/decrease)
profile_count INTEGER DEFAULT 0
```

### Migration File

Location: `server/database/migration-add-paid-slots.sql`

Run this migration in your Supabase SQL Editor to add the new fields.

## API Endpoints

### 1. Check Profile Payment Status

**Endpoint**: `POST /api/payment/subscription/check-profile-payment`

**Purpose**: Check if user needs to pay for additional profiles

**Request**:
```json
{
  "gbpAccountId": "accounts/123456",
  "userId": "firebase_uid_123",
  "currentProfileCount": 12
}
```

**Response (Payment Needed)**:
```json
{
  "paymentNeeded": true,
  "paidSlots": 10,
  "currentProfiles": 12,
  "additionalProfilesNeeded": 2,
  "message": "You have 10 paid slots but 12 profiles. Please pay for 2 additional profiles."
}
```

**Response (No Payment Needed)**:
```json
{
  "paymentNeeded": false,
  "paidSlots": 10,
  "currentProfiles": 8,
  "unusedSlots": 2,
  "message": "You have 10 paid slots and 8 profiles. No payment needed."
}
```

### 2. Update Profile Count

**Endpoint**: `POST /api/payment/subscription/update-profile-count`

**Purpose**: Update the current active profile count (called automatically when profiles change)

**Request**:
```json
{
  "gbpAccountId": "accounts/123456",
  "userId": "firebase_uid_123",
  "currentProfileCount": 8
}
```

**Response**:
```json
{
  "success": true,
  "profileCount": 8,
  "paidSlots": 10,
  "message": "Profile count updated successfully"
}
```

## Frontend Implementation

### PaymentModal Component

**Location**: `src/components/PaymentModal.tsx`

**Features**:
1. Automatically checks slot status when modal opens
2. Shows visual breakdown of paid slots, active profiles, and unused/needed slots
3. Auto-calculates payment for ONLY additional profiles beyond paid slots
4. Displays clear messaging about slot availability

**Visual Display**:
```
┌─────────────────────────────────────────────┐
│ Your Subscription Slots                      │
├─────────────────────────────────────────────┤
│  Paid Slots    Active Profiles   Unused     │
│      10              8              2        │
└─────────────────────────────────────────────┘
```

### Automatic Profile Count Tracking

**Location**: `src/hooks/useGoogleBusinessProfile.ts`

**How it works**:
1. When profiles are loaded from Google Business Profile API
2. System counts total locations across all accounts
3. Automatically calls `updateProfileCount` API to update backend
4. Runs every time profiles are fetched or refreshed

**Code**:
```typescript
// Update current active profile count
await updateProfileCount(account.accountId, totalLocations);
```

## Backend Implementation

### Payment Verification Logic

**Location**: `server/routes/payment.js` (line 560-592)

**Key Changes**:
```javascript
// OLD SYSTEM (wrong):
profileCount = currentProfileCount + newProfileCount; // Would double-count

// NEW SYSTEM (correct):
const currentPaidSlots = subscription.paidSlots || 0;
const newPaidSlots = currentPaidSlots + profileCount; // ADD to paid slots

paidSlots: newPaidSlots,  // Total slots purchased (never decreases)
profileCount: newPaidSlots // Update current count to match
```

### Subscription Service

**Location**: `server/services/subscriptionService.js`

**No changes needed** - the service already supports flexible field updates through `updateSubscription` method.

## User Flow Examples

### Example 1: New User

1. User connects 5 Google Business Profiles
2. Payment modal shows: "Pay for 5 profiles at $99/profile/year"
3. User pays $495
4. System sets:
   - `paidSlots = 5`
   - `profileCount = 5`
5. User can manage 5 profiles for 1 year

### Example 2: Adding Profiles

1. User has 5 paid slots, 5 active profiles
2. User adds 3 new profiles in Google Business Profile
3. System detects 8 profiles, but only 5 paid slots
4. Payment modal shows: "Pay for 3 additional profiles" (not 8!)
5. User pays $297 (3 × $99)
6. System updates:
   - `paidSlots = 8` (5 + 3)
   - `profileCount = 8`

### Example 3: Deleting Profiles

1. User has 8 paid slots, 8 active profiles
2. User deletes 2 profiles
3. System updates:
   - `paidSlots = 8` (unchanged!)
   - `profileCount = 6`
4. User has 2 unused slots
5. User can add 2 more profiles without payment

### Example 4: Adding Within Paid Slots

1. User has 8 paid slots, 6 active profiles (deleted 2 earlier)
2. User adds 1 new profile
3. System detects 7 profiles, 8 paid slots
4. NO payment needed!
5. System updates:
   - `paidSlots = 8` (unchanged)
   - `profileCount = 7`
6. User still has 1 unused slot

## Benefits

✅ **Fair Pricing**: Users only pay for NEW profiles beyond their paid slots
✅ **Flexibility**: Users can add/delete profiles freely during subscription period
✅ **No Refunds Needed**: Deleted profiles don't decrease paid slots
✅ **Clear Communication**: Visual display shows exactly what user is paying for
✅ **Automatic Tracking**: Profile counts update automatically when profiles change
✅ **No Double Charging**: System never charges for the same profile twice

## Testing Checklist

- [ ] Run database migration: `migration-add-paid-slots.sql`
- [ ] Test initial payment for X profiles
- [ ] Test adding profiles beyond paid slots (should charge for additional only)
- [ ] Test deleting profiles (paid slots should not decrease)
- [ ] Test adding profiles within paid slots (should not charge)
- [ ] Verify automatic profile count tracking works
- [ ] Check payment modal displays slot information correctly
- [ ] Verify subscription status API returns correct slot data

## Deployment Steps

1. **Database Migration**:
   ```sql
   -- Run in Supabase SQL Editor
   -- File: server/database/migration-add-paid-slots.sql
   ```

2. **Backend Deployment**:
   - Deploy updated `server/routes/payment.js`
   - No changes needed to `server/services/subscriptionService.js`

3. **Frontend Deployment**:
   - Deploy updated `src/components/PaymentModal.tsx`
   - Deploy updated `src/hooks/useGoogleBusinessProfile.ts`

4. **Verification**:
   - Check logs for "[Profile Count] Updated successfully"
   - Check logs for "[Payment Verify] Slot-based subscription update"
   - Verify payment modal shows slot information

## Monitoring

### Log Messages to Watch

**Frontend**:
```
[PaymentModal] Slot check result: {...}
[Profile Count] Account X: Y profiles tracked
```

**Backend**:
```
[Payment Verify] Slot-based subscription update: {...}
[Profile Payment Check] Slot analysis: {...}
[Update Profile Count] Updated profileCount to: X
```

### Key Metrics

- Average paid slots per user
- Average active profiles per user
- Percentage of users with unused slots
- Incremental payment conversion rate (when users add profiles)

## Support Scenarios

### User: "Why am I being charged again?"

**Answer**: "You're not being charged for your existing profiles. You have X paid slots for Y profiles, and you just added Z new profiles. We're only charging you for the Z additional profiles at $99 each."

### User: "I deleted a profile, where's my refund?"

**Answer**: "Your subscription is based on paid slots, not active profiles. You paid for X slots for the year, and you can use them anytime. You currently have Y active profiles and Z unused slots. You can add Z more profiles without any additional payment!"

### User: "How many profiles can I add?"

**Answer**: "You have X paid slots and Y active profiles, so you can add Z more profiles without payment. After that, you'll pay $99/year for each additional profile."

## Future Enhancements

1. **Slot Rollover**: Allow unused slots to roll over to next year
2. **Slot Gifting**: Allow users to transfer unused slots to other accounts
3. **Tiered Pricing**: Discount for buying more slots (e.g., 10+ slots get 10% off)
4. **Slot Analytics**: Dashboard showing slot usage trends over time
5. **Proactive Notifications**: Email users when they're about to exceed paid slots

## Technical Notes

- Paid slots are tied to subscription period (1 year)
- When subscription expires, both `paidSlots` and `profileCount` can be reset
- For auto-renewal, `paidSlots` should be preserved for the new period
- System tracks `paidLocationIds` array for audit purposes
- Profile count updates are non-blocking (don't fail if backend is down)

---

**Last Updated**: December 7, 2025
**Version**: 1.0
**Status**: ✅ Implemented and Ready for Testing
