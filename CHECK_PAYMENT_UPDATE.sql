-- ============================================================================
-- CHECK AND FIX PAYMENT UPDATE ISSUE
-- ============================================================================
-- Problem: User paid for 6 more profiles but paid_slots didn't update
-- Expected: 3 + 6 = 9 paid_slots
-- Actual: Still showing 3 paid_slots
-- ============================================================================

BEGIN;

-- STEP 1: Check all subscriptions for hello.lobaiseo@gmail.com
-- ============================================================================
SELECT
  id,
  email,
  gbp_account_id,
  status,
  profile_count as current_profiles,
  paid_slots as paid_for_profiles,
  plan_id,
  amount,
  last_payment_date,
  created_at,
  updated_at
FROM subscriptions
WHERE email = 'hello.lobaiseo@gmail.com'
ORDER BY created_at DESC;

-- STEP 2: Delete DUPLICATE subscriptions (keep only the latest active one)
-- ============================================================================
-- Find duplicate subscriptions
WITH ranked_subscriptions AS (
  SELECT
    id,
    email,
    status,
    paid_slots,
    updated_at,
    ROW_NUMBER() OVER (
      PARTITION BY email
      ORDER BY
        CASE WHEN status = 'active' THEN 1 ELSE 2 END, -- Active first
        updated_at DESC, -- Most recent first
        paid_slots DESC -- Highest paid_slots first
    ) as row_num
  FROM subscriptions
  WHERE email = 'hello.lobaiseo@gmail.com'
)
SELECT * FROM ranked_subscriptions;

-- Delete duplicate subscriptions (keep only row_num = 1)
DELETE FROM subscriptions
WHERE id IN (
  SELECT id
  FROM (
    SELECT
      id,
      ROW_NUMBER() OVER (
        PARTITION BY email
        ORDER BY
          CASE WHEN status = 'active' THEN 1 ELSE 2 END,
          updated_at DESC,
          paid_slots DESC
      ) as row_num
    FROM subscriptions
    WHERE email = 'hello.lobaiseo@gmail.com'
  ) sub
  WHERE row_num > 1
);

-- STEP 3: Update the remaining subscription to have correct paid_slots
-- ============================================================================
-- User originally had 3 paid slots and just paid for 6 more = 9 total
UPDATE subscriptions
SET
  paid_slots = 9,  -- 3 original + 6 new = 9 total
  status = 'active',
  plan_id = 'per_profile_yearly',
  updated_at = NOW()
WHERE email = 'hello.lobaiseo@gmail.com'
  AND status = 'active';

COMMIT;

-- STEP 4: Verify the fix
-- ============================================================================
SELECT
  email,
  status,
  profile_count as current_profiles,
  paid_slots as paid_for_profiles,
  (paid_slots - profile_count) as available_slots,
  plan_id,
  TO_CHAR(subscription_end_date, 'YYYY-MM-DD') as expires_on,
  TO_CHAR(last_payment_date, 'YYYY-MM-DD HH24:MI:SS') as last_payment
FROM subscriptions
WHERE email = 'hello.lobaiseo@gmail.com'
ORDER BY created_at DESC;

-- ============================================================================
-- EXPECTED RESULT:
-- ============================================================================
-- email: hello.lobaiseo@gmail.com
-- status: active
-- current_profiles: 1 (or whatever is currently connected)
-- paid_for_profiles: 9 (3 original + 6 new payment)
-- available_slots: 8 (9 - 1 = 8 available)
-- plan_id: per_profile_yearly
-- ============================================================================
