-- ============================================================================
-- CRITICAL FIX: SUBSCRIPTION SLOT-BASED SYSTEM
-- ============================================================================
-- This SQL script fixes the subscription data issue where users who paid for
-- multiple profiles (e.g., 3 profiles) only get access to 1 profile.
--
-- PROBLEM: When agencies add/delete profiles, the system was losing track of
-- how many profiles the user PAID FOR (paidSlots).
--
-- SOLUTION: Separate paidSlots (what user paid for) from profileCount (current active profiles)
--
-- RUN THIS IN SUPABASE SQL EDITOR
-- ============================================================================

BEGIN;

-- STEP 1: Add paid_slots column (if not exists)
-- ============================================================================
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_slots INTEGER DEFAULT 0;

-- STEP 2: Add paid_location_ids column (if not exists)
-- ============================================================================
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_location_ids TEXT[] DEFAULT '{}';

-- STEP 3: Create indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_subscriptions_paid_slots ON subscriptions(paid_slots);

-- STEP 4: Add helpful comments
-- ============================================================================
COMMENT ON COLUMN subscriptions.paid_slots IS 'Number of profile slots the user has PAID for (never decreases when profiles are deleted)';
COMMENT ON COLUMN subscriptions.paid_location_ids IS 'Array of location IDs that have been paid for';
COMMENT ON COLUMN subscriptions.profile_count IS 'Current number of active profiles (can increase/decrease as profiles are added/deleted)';

-- STEP 5: Migrate existing data
-- ============================================================================
-- For subscriptions that don't have paid_slots set, use profile_count as the initial value
UPDATE subscriptions
SET paid_slots = COALESCE(profile_count, 0)
WHERE paid_slots = 0 OR paid_slots IS NULL;

-- STEP 6: Fix specific subscriptions with known issues
-- ============================================================================
-- UPDATE THIS SECTION WITH YOUR ACTUAL USER DATA
-- Replace 'USER_EMAIL_HERE' with the actual email address
-- Replace 3 with the actual number of profiles they paid for

-- Example: If hello.lobaiseo@gmail.com paid for 3 profiles:
UPDATE subscriptions
SET
  paid_slots = 3,
  updated_at = NOW()
WHERE email = 'hello.lobaiseo@gmail.com'
  AND status = 'active'
  AND (paid_slots < 3 OR paid_slots IS NULL);

-- Add more UPDATE statements here for other affected users
-- UPDATE subscriptions
-- SET paid_slots = X, updated_at = NOW()
-- WHERE email = 'other.user@example.com' AND status = 'active';

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================
-- Run these to verify the fix worked

-- View all active subscriptions with their slot information
SELECT
  email,
  status,
  profile_count as current_profiles,
  paid_slots as paid_for_profiles,
  (paid_slots - profile_count) as available_slots,
  TO_CHAR(subscription_end_date, 'YYYY-MM-DD') as expires_on
FROM subscriptions
WHERE status IN ('active', 'trial')
ORDER BY created_at DESC;

-- ============================================================================
-- EXPECTED RESULTS:
-- ============================================================================
-- email                        | status | current | paid_for | available | expires_on
-- ---------------------------- | ------ | ------- | -------- | --------- | ----------
-- hello.lobaiseo@gmail.com     | active |    1-3  |    3     |    0-2    | 2026-XX-XX
--
-- After this fix:
-- - paid_for_profiles (paid_slots) = number user PAID FOR (e.g., 3)
-- - current_profiles (profile_count) = number currently active (can vary as profiles are added/deleted)
-- - available_slots = paid_slots - profile_count
-- - The app will now correctly allow access to ALL paid_slots, not just current profile_count
-- ============================================================================

-- ============================================================================
-- NEXT STEPS AFTER RUNNING THIS SQL:
-- ============================================================================
-- 1. Verify the results using the SELECT query above
-- 2. Deploy the updated backend code to Docker/Azure
-- 3. Test adding/deleting profiles to ensure paidSlots remains stable
-- 4. The app should now show correct subscription access!
-- ============================================================================
