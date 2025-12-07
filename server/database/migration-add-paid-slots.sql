-- Migration: Add paid_slots field to subscriptions table
-- This field tracks how many profile slots the user has PAID for
-- separate from how many profiles they currently have active
-- Run this in your Supabase SQL Editor

-- Add paid_slots column to subscriptions table
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_slots INTEGER DEFAULT 0;

-- Add paid_location_ids to track which specific locations are paid for
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS paid_location_ids TEXT[] DEFAULT '{}';

-- Update existing subscriptions to set paid_slots = profile_count
-- This ensures existing customers don't lose their paid slots
UPDATE subscriptions
SET paid_slots = COALESCE(profile_count, 0)
WHERE paid_slots = 0 OR paid_slots IS NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_paid_slots ON subscriptions(paid_slots);

-- Add comment
COMMENT ON COLUMN subscriptions.paid_slots IS 'Number of profile slots the user has PAID for (does not decrease when profiles are deleted)';
COMMENT ON COLUMN subscriptions.paid_location_ids IS 'Array of location IDs that have been paid for';

-- ============================================
-- VERIFICATION QUERIES (Optional - for testing only)
-- ============================================
-- These queries help verify the migration worked correctly.
-- LIMIT 10 means "show first 10 rows as a sample" - NOT a restriction!
-- Users can have UNLIMITED profiles - there is NO limit in the system!

-- Verify new columns were added and existing data was migrated
-- SELECT id, email, profile_count, paid_slots, paid_location_ids FROM subscriptions LIMIT 10;

-- Check if any subscriptions need manual review
-- SELECT COUNT(*) as total_subscriptions FROM subscriptions;
-- SELECT COUNT(*) as subscriptions_with_paid_slots FROM subscriptions WHERE paid_slots > 0;
