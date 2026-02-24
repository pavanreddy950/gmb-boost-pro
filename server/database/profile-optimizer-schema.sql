-- ============================================
-- AI PROFILE OPTIMIZER - Single Table Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop the old 6 tables (if they were created)
DROP TABLE IF EXISTS content_fingerprints CASCADE;
DROP TABLE IF EXISTS optimization_settings CASCADE;
DROP TABLE IF EXISTS optimization_change_history CASCADE;
DROP TABLE IF EXISTS deployment_schedule CASCADE;
DROP TABLE IF EXISTS optimization_suggestions CASCADE;
DROP TABLE IF EXISTS optimization_jobs CASCADE;

-- Step 2: Create the single unified table
CREATE TABLE IF NOT EXISTS profile_optimizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  gmail_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  -- Status: pending, auditing, generating, reviewing, scheduled, deploying, completed, failed, cancelled
  audit_score INTEGER,
  audit_data JSONB,
  risk_score INTEGER,
  suggestions JSONB DEFAULT '[]'::jsonb,
  -- Array of suggestion objects with id, suggestion_type, original_content, suggested_content, etc.
  deployments JSONB DEFAULT '[]'::jsonb,
  -- Array of deployment objects with id, deploy_type, deploy_day, status, scheduled_at, etc.
  change_history JSONB DEFAULT '[]'::jsonb,
  -- Array of change records with id, change_type, old_value, new_value, etc.
  settings JSONB DEFAULT '{}'::jsonb,
  -- User preferences: preferred_tone, target_keywords, etc.
  fingerprints JSONB DEFAULT '{}'::jsonb,
  -- Content fingerprints keyed by content_type: { description: { content_hash, simhash, shingles } }
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_profile_optimizations_gmail_id ON profile_optimizations(gmail_id);
CREATE INDEX IF NOT EXISTS idx_profile_optimizations_location_id ON profile_optimizations(location_id);
CREATE INDEX IF NOT EXISTS idx_profile_optimizations_status ON profile_optimizations(status);
CREATE INDEX IF NOT EXISTS idx_profile_optimizations_created_at ON profile_optimizations(created_at DESC);

-- Auto-update timestamp trigger
CREATE TRIGGER update_profile_optimizations_updated_at
  BEFORE UPDATE ON profile_optimizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Permissions
GRANT ALL ON profile_optimizations TO postgres, anon, authenticated, service_role;

-- Comment
COMMENT ON TABLE profile_optimizations IS 'Single table for AI Profile Optimizer - stores jobs, suggestions, deployments, history, settings, and fingerprints';

-- ============================================
-- DONE - 1 table replaces 6!
-- ============================================
