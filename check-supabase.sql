-- Run this query in your Supabase SQL Editor to check automation settings

-- Check automation_settings table
SELECT
  user_id,
  location_id,
  enabled,
  auto_reply_enabled,
  settings->>'autoPosting' as auto_posting_config,
  (settings->'autoPosting'->>'enabled')::boolean as posting_enabled,
  (settings->'autoPosting'->>'schedule') as schedule_time,
  (settings->'autoPosting'->>'frequency') as frequency,
  updated_at
FROM automation_settings
ORDER BY updated_at DESC;

-- Count enabled automations
SELECT
  COUNT(*) as total_rows,
  COUNT(*) FILTER (WHERE enabled = true) as enabled_count,
  COUNT(*) FILTER (WHERE (settings->'autoPosting'->>'enabled')::boolean = true) as auto_posting_enabled_count
FROM automation_settings;
