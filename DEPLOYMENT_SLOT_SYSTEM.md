# Deployment Guide: Slot-Based Subscription System

## Quick Start

This guide will help you deploy the slot-based subscription system that prevents subscription mismatches when users add or delete Google Business Profiles.

## Prerequisites

- Access to Supabase SQL Editor
- Backend deployment access (Azure/Local)
- Frontend build and deployment access

## Step 1: Database Migration (CRITICAL - Do This First!)

### 1.1 Run Migration in Supabase

1. Open your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Open the file: `server/database/migration-add-paid-slots.sql`
4. Copy the entire content
5. Paste into Supabase SQL Editor
6. Click **Run**

### 1.2 Verify Migration

Run this query to verify the new columns exist:

```sql
SELECT
  id,
  email,
  profile_count,
  paid_slots,
  paid_location_ids
FROM subscriptions
LIMIT 5;
```

Expected output:
- `paid_slots` column should exist
- `paid_location_ids` column should exist
- Existing rows should have `paid_slots` = `profile_count` (migrated automatically)

## Step 2: Backend Deployment

### 2.1 Files Changed

✅ `server/routes/payment.js` - Updated payment verification logic
✅ `server/database/migration-add-paid-slots.sql` - New migration file

### 2.2 Deploy Backend

**Option A: Azure Deployment**
```bash
cd server
npm run build
# Deploy to Azure (your existing process)
```

**Option B: Local Testing**
```bash
cd server
npm install
npm run dev
```

### 2.3 Verify Backend Deployment

Test the new endpoints:

```bash
# Test profile payment check
curl -X POST http://localhost:5000/api/payment/subscription/check-profile-payment \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "currentProfileCount": 5
  }'

# Test profile count update
curl -X POST http://localhost:5000/api/payment/subscription/update-profile-count \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test_user_123",
    "currentProfileCount": 5
  }'
```

## Step 3: Frontend Deployment

### 3.1 Files Changed

✅ `src/components/PaymentModal.tsx` - Slot-based payment UI
✅ `src/hooks/useGoogleBusinessProfile.ts` - Automatic profile count tracking

### 3.2 Build Frontend

```bash
npm install
npm run build
```

### 3.3 Deploy Frontend

Deploy the `dist` folder to your hosting service (Vercel, Netlify, etc.)

## Step 4: Testing

### 4.1 Test Scenario 1: Initial Payment

1. Connect a Google Business Profile with 3 locations
2. Open Payment Modal
3. ✅ Should show: "Pay for 3 profiles"
4. Complete payment
5. ✅ Verify in Supabase:
   - `paid_slots = 3`
   - `profile_count = 3`

### 4.2 Test Scenario 2: Adding Profiles

1. Add 2 new profiles in Google Business Profile
2. Refresh the dashboard
3. Open Payment Modal
4. ✅ Should show: "Pay for 2 additional profiles" (not 5!)
5. Complete payment
6. ✅ Verify in Supabase:
   - `paid_slots = 5` (3 + 2)
   - `profile_count = 5`

### 4.3 Test Scenario 3: Deleting Profiles

1. Delete 2 profiles from Google Business Profile
2. Refresh the dashboard
3. ✅ Verify in Supabase:
   - `paid_slots = 5` (unchanged!)
   - `profile_count = 3`
4. Open Payment Modal
5. ✅ Should show: "All profiles covered! 2 unused slots"

### 4.4 Test Scenario 4: Adding Within Paid Slots

1. Add 1 new profile (user has 5 paid slots, 3 active)
2. Refresh the dashboard
3. ✅ Should NOT show payment modal
4. ✅ Verify in Supabase:
   - `paid_slots = 5` (unchanged)
   - `profile_count = 4`
5. If payment modal is opened manually
6. ✅ Should show: "All profiles covered! 1 unused slot"

## Step 5: Monitoring

### 5.1 Backend Logs to Watch

Monitor your backend logs for these messages:

**Good Signs** ✅:
```
[Payment Verify] Slot-based subscription update: {...}
[Profile Payment Check] Slot analysis: {...}
[Update Profile Count] Updated profileCount to: X
[Profile Count] Account X: Y profiles tracked
```

**Warning Signs** ⚠️:
```
[Profile Payment Check] No subscription found
[Update Profile Count] Failed to update
[Payment Verify] profileCount missing from order notes
```

### 5.2 Database Queries

Monitor subscription health:

```sql
-- Users with unused slots
SELECT
  email,
  paid_slots,
  profile_count,
  (paid_slots - profile_count) as unused_slots
FROM subscriptions
WHERE paid_slots > profile_count
  AND status = 'active';

-- Users who need to pay for additional profiles
SELECT
  email,
  paid_slots,
  profile_count,
  (profile_count - paid_slots) as additional_needed
FROM subscriptions
WHERE profile_count > paid_slots
  AND status = 'active';

-- Average slot utilization
SELECT
  AVG(profile_count::float / NULLIF(paid_slots, 0)) * 100 as utilization_percentage
FROM subscriptions
WHERE paid_slots > 0
  AND status = 'active';
```

## Step 6: Rollback Plan (If Needed)

If something goes wrong, here's how to rollback:

### 6.1 Database Rollback

```sql
-- Remove new columns (if needed)
ALTER TABLE subscriptions
DROP COLUMN IF EXISTS paid_slots;

ALTER TABLE subscriptions
DROP COLUMN IF EXISTS paid_location_ids;
```

### 6.2 Code Rollback

```bash
# Rollback to previous git commit
git revert HEAD

# Redeploy old version
npm run build
# Deploy...
```

## Step 7: User Communication

### 7.1 Announcement Template

```
🎉 New Feature: Flexible Profile Management!

We've improved how subscription slots work:

✅ Pay only for NEW profiles beyond your plan
✅ Keep your paid slots when you delete profiles
✅ Add/delete profiles freely during your subscription year

Example:
- You paid for 10 profiles? You have 10 slots for the year!
- Delete 3 profiles? You still have 10 slots (no refund, but you can add 3 more profiles without payment)
- Add an 11th profile? Pay only for the 1 additional profile

Questions? Contact support!
```

### 7.2 FAQ Updates

**Q: What happens if I delete a profile?**
A: Your paid slots remain the same. You can add new profiles up to your paid slot limit without additional payment.

**Q: What happens if I add more profiles?**
A: You'll only pay for the additional profiles beyond your current paid slots at $99/profile/year.

**Q: Do I get a refund if I delete profiles?**
A: No refunds, but you keep your paid slots for the entire subscription year. You can add new profiles without payment up to your paid slot limit.

## Step 8: Support Preparation

### 8.1 Common Support Questions

**Issue**: "Why am I seeing 'Pay for X additional profiles'?"

**Response**:
```
You currently have [Y] paid slots but [Z] active profiles.
We're only charging you for the [X] additional profiles you've added.

Your paid slots: [Y]
Your active profiles: [Z]
Additional payment needed: [X] profiles × $99 = $[amount]
```

**Issue**: "I deleted profiles, where's my refund?"

**Response**:
```
Your subscription is based on paid slots, not active profiles.
You paid for [X] slots for the year, and those are yours to use.

Paid slots: [X]
Active profiles: [Y]
Unused slots: [Z]

You can add [Z] more profiles without any payment!
```

### 8.2 Admin Tools

Check user's subscription status:

```sql
SELECT
  email,
  status,
  paid_slots,
  profile_count,
  (paid_slots - profile_count) as unused_slots,
  subscription_end_date
FROM subscriptions
WHERE email = 'user@example.com';
```

## Step 9: Post-Deployment Checklist

- [ ] Database migration completed successfully
- [ ] Backend deployed and logs show slot-based updates
- [ ] Frontend deployed and payment modal shows slot info
- [ ] Test scenario 1 passed (initial payment)
- [ ] Test scenario 2 passed (adding profiles)
- [ ] Test scenario 3 passed (deleting profiles)
- [ ] Test scenario 4 passed (adding within paid slots)
- [ ] Monitoring queries set up
- [ ] Support team trained on new system
- [ ] User announcement sent (if applicable)
- [ ] Documentation updated

## Troubleshooting

### Issue: "paid_slots column doesn't exist"

**Solution**: Run the migration SQL file in Supabase

### Issue: "Payment modal doesn't show slot info"

**Solution**:
1. Check browser console for errors
2. Verify backend endpoints are accessible
3. Check if subscription exists in database

### Issue: "Profile count not updating automatically"

**Solution**:
1. Check backend logs for "[Profile Count] Updated successfully"
2. Verify GBP connection is active
3. Try manual refresh: `refreshAccounts()` function

### Issue: "User charged for all profiles instead of additional only"

**Solution**:
1. Check if migration was run (paid_slots should exist)
2. Verify payment verification logic is using `paidSlots`
3. Check payment notes for profileCount

## Success Metrics

After deployment, track these metrics:

1. **Incremental Payment Conversion**: % of users who pay for additional profiles
2. **Slot Utilization**: Average profileCount / paidSlots ratio
3. **Unused Slots**: % of users with unused slots
4. **Support Tickets**: Should decrease for subscription-related issues

## Next Steps

After successful deployment:

1. Monitor for 1 week for any issues
2. Gather user feedback
3. Consider implementing [Future Enhancements](SLOT_BASED_SUBSCRIPTION_SYSTEM.md#future-enhancements)
4. Update marketing materials to highlight flexible profile management

---

**Deployment Date**: _________________
**Deployed By**: _________________
**Status**: ☐ Success | ☐ Issues (describe): _________________

## Support Contact

For deployment issues, contact:
- Technical Lead: [Your Name]
- Database Admin: [DBA Name]
- DevOps: [DevOps Contact]
