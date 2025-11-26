-- =====================================================
-- Scalability Database Schema - CLEAN INSTALL
-- This will DROP existing tables and recreate them
-- =====================================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS leader_election CASCADE;

-- 1. Leader Election Table
CREATE TABLE leader_election (
  role TEXT PRIMARY KEY,
  server_id TEXT NOT NULL,
  last_heartbeat TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for quick heartbeat checks
CREATE INDEX idx_leader_heartbeat ON leader_election(last_heartbeat);

-- 2. Automation Logs Table
CREATE TABLE automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  success BOOLEAN NOT NULL DEFAULT true,
  post_id TEXT,
  error_message TEXT,
  scheduled_time TIMESTAMPTZ,
  execution_time_ms INTEGER,
  config JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast queries
CREATE INDEX idx_automation_logs_location ON automation_logs(location_id);
CREATE INDEX idx_automation_logs_user ON automation_logs(user_id);
CREATE INDEX idx_automation_logs_created ON automation_logs(created_at DESC);
CREATE INDEX idx_automation_logs_event_type ON automation_logs(event_type);
CREATE INDEX idx_automation_logs_success ON automation_logs(success) WHERE success = false;
CREATE INDEX idx_automation_logs_user_created ON automation_logs(user_id, created_at DESC);

-- 3. Database Functions
CREATE OR REPLACE FUNCTION get_connection_count()
RETURNS INTEGER AS $$
BEGIN
  RETURN (SELECT count(*)::INTEGER FROM pg_stat_activity WHERE datname = current_database());
END;
$$ LANGUAGE plpgsql;

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
    (schemaname || '.' || tablename)::TEXT AS table_name,
    n_live_tup AS row_count,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_indexes_size(schemaname||'.'||tablename)) AS index_size
  FROM pg_stat_user_tables
  ORDER BY n_live_tup DESC;
END;
$$ LANGUAGE plpgsql;

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

-- Verification
SELECT 'leader_election' as table_name, COUNT(*) as row_count FROM leader_election
UNION ALL
SELECT 'automation_logs' as table_name, COUNT(*) as row_count FROM automation_logs;

SELECT get_connection_count() AS active_db_connections;

-- ✅ Installation Complete!
SELECT '✅ Scalability schema installed successfully!' as status;
