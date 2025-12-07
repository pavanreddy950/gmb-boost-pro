-- ==================================================
-- COMPLETE FIX FOR SLOT-BASED SUBSCRIPTION SYSTEM
-- Run this DIRECTLY in Supabase SQL Editor
-- ==================================================

-- STEP 1: Add paid_slots columns (if not already added)
-- ==================================================
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_slots INTEGER DEFAULT 0;

ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_location_ids TEXT[] DEFAULT '{}';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_paid_slots ON subscriptions(paid_slots);

-- Add comments
COMMENT ON COLUMN subscriptions.paid_slots IS 'Number of profile slots the user has PAID for (does not decrease when profiles are deleted)';
COMMENT ON COLUMN subscriptions.paid_location_ids IS 'Array of location IDs that have been paid for';


-- STEP 2: Set paid_slots = profile_count for existing subscriptions
-- ==================================================
UPDATE subscriptions
SET paid_slots = COALESCE(profile_count, 0)
WHERE paid_slots = 0 OR paid_slots IS NULL;


-- STEP 3: Fix specific user (hello.lobaiseo@gmail.com) to have 3 paid slots
-- ==================================================
-- Change the number 3 to however many profiles this user paid for
UPDATE subscriptions
SET
  paid_slots = 3,
  profile_count = 3,
  updated_at = NOW()
WHERE email = 'hello.lobaiseo@gmail.com'
  AND status = 'active';


-- STEP 4: Verify all subscriptions
-- ==================================================
SELECT
  email,
  status,
  profile_count,
  paid_slots,
  (paid_slots - profile_count) as unused_slots,
  subscription_end_date
FROM subscriptions
WHERE status IN ('active', 'trial')
ORDER BY created_at DESC;


-- ==================================================
-- EXPECTED RESULT for hello.lobaiseo@gmail.com:
-- email: hello.lobaiseo@gmail.com
-- status: active
-- profile_count: 3
-- paid_slots: 3
-- unused_slots: 0
-- ==================================================

-- DONE! Now:
-- 1. Restart backend: docker pull scale112/pavan-client-backend:latest && docker restart pavan-client
-- 2. Rebuild frontend: npm run build
-- 3. Deploy frontend dist folder
-- 4. Refresh browser (Ctrl+F5)
-- 5. All 3 profiles should be unlocked!
