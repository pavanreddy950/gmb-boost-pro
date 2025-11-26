-- =====================================================
-- Scalability Database Schema
-- Run this in Supabase SQL Editor
-- =====================================================

-- 1. Leader Election Table
-- Prevents duplicate cron jobs in multi-server deployments
CREATE TABLE IF NOT EXISTS leader_election (
  role TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick heartbeat checks
CREATE INDEX IF NOT EXISTS idx_leader_heartbeat ON leader_election(last_heartbeat);

-- =====================================================
-- 2. Automation Logs Table
-- Tracks all automation events for debugging and monitoring
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL, -- 'cron_trigger', 'post_created', 'post_failed', etc.
  success BOOLEAN NOT NULL DEFAULT true,
  post_id TEXT,
  error_message TEXT,
  scheduled_time TIMESTAMPTZ,
  execution_time_ms INTEGER,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX IF NOT EXISTS idx_automation_logs_location ON automation_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_user ON automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_automation_logs_event_type ON automation_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_automation_logs_success ON automation_logs(success) WHERE success = false;

-- Composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_created ON automation_logs(user_id, created_at DESC);

-- =====================================================
-- 3. Performance Indexes for Existing Tables
-- These speed up common queries

-- User tokens - already indexed, but ensuring
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at ON user_tokens(expires_at);

-- Automation settings
CREATE INDEX IF NOT EXISTS idx_automation_settings_user_id ON automation_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_settings_location_id ON automation_settings(location_id);
CREATE INDEX IF NOT EXISTS idx_automation_settings_enabled ON automation_settings(enabled) WHERE enabled = true;
CREATE INDEX IF NOT EXISTS idx_automation_settings_updated ON automation_settings(updated_at DESC);

-- Subscriptions
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(subscription_end_date);
CREATE INDEX IF NOT EXISTS idx_subscriptions_trial_end ON subscriptions(trial_end_date);

-- Trial emails sent
CREATE INDEX IF NOT EXISTS idx_trial_emails_user_id ON trial_emails_sent(user_id);
CREATE INDEX IF NOT EXISTS idx_trial_emails_sent_at ON trial_emails_sent(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_trial_emails_type ON trial_emails_sent(email_type);

-- =====================================================
-- 4. Database Functions for Monitoring

-- Get active database connections
CREATE OR REPLACE FUNCTION get_connection_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT count(*) FROM pg_stat_activity WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql;

-- Get table statistics
CREATE OR REPLACE FUNCTION get_table_stats()
RETURNS TABLE(
  table_name TEXT,
  row_count BIGINT,
  total_size TEXT,
  index_size TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    schemaname || '.' || tablename AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
END;
$$ LANGUAGE plpgsql;

-- Get slow queries (queries taking > 1 second)
CREATE OR REPLACE FUNCTION get_slow_queries()
RETURNS TABLE(
  query_text TEXT,
  calls BIGINT,
  mean_time_ms NUMERIC,
  total_time_ms NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    query AS query_text,
    calls,
    ROUND((mean_exec_time)::numeric, 2) AS mean_time_ms,
    ROUND((total_exec_time)::numeric, 2) AS total_time_ms
  FROM pg_stat_statements
  WHERE mean_exec_time > 1000  -- Queries taking > 1 second
  ORDER BY mean_exec_time DESC
  LIMIT 20;
END;
$$ LANGUAGE plpgsql;

-- Get cache effectiveness
CREATE OR REPLACE FUNCTION get_cache_stats()
RETURNS TABLE(
  cache_type TEXT,
  hit_rate NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    'index' AS cache_type,
    ROUND(
      (sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit + idx_blks_read), 0) * 100)::numeric, 
      2
    ) AS hit_rate
  FROM pg_statio_user_indexes
  UNION ALL
  SELECT 
    'table' AS cache_type,
    ROUND(
      (sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit + heap_blks_read), 0) * 100)::numeric,
      2
    ) AS hit_rate
  FROM pg_statio_user_tables;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 5. Cleanup Functions

-- Clean old automation logs (keep last 30 days)
CREATE OR REPLACE FUNCTION cleanup_old_automation_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM automation_logs
  WHERE created_at < NOW() - INTERVAL '30 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Clean expired trial email records (keep last 90 days)
CREATE OR REPLACE FUNCTION cleanup_old_trial_emails()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM trial_emails_sent
  WHERE sent_at < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. Scheduled Jobs (Optional - run via cron or manually)

-- Example: Schedule cleanup to run weekly
-- CREATE EXTENSION IF NOT EXISTS pg_cron;
-- 
-- SELECT cron.schedule(
--   'cleanup-automation-logs',
--   '0 3 * * 0',  -- Every Sunday at 3 AM
--   'SELECT cleanup_old_automation_logs();'
-- );
--
-- SELECT cron.schedule(
--   'cleanup-trial-emails',
--   '0 4 * * 0',  -- Every Sunday at 4 AM
--   'SELECT cleanup_old_trial_emails();'
-- );

-- =====================================================
-- 7. Grants (if using Row Level Security)

-- Allow service role to manage leader election
-- ALTER TABLE leader_election ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Service role can manage leader_election" 
-- ON leader_election FOR ALL 
-- USING (auth.role() = 'service_role');

-- =====================================================
-- VERIFICATION QUERIES
-- Run these to verify installation

-- Check if tables exist
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN ('leader_election', 'automation_logs')
ORDER BY tablename;

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('leader_election', 'automation_logs', 'user_tokens', 'automation_settings')
ORDER BY tablename, indexname;

-- Test functions
SELECT get_connection_count() AS active_connections;
SELECT * FROM get_table_stats() LIMIT 5;

-- =====================================================
-- DONE!
-- ✅ All scalability database components installed
-- =====================================================
