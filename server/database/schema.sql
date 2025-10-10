-- GMB Boost Pro - Supabase Database Schema
-- Run this in your Supabase SQL Editor after creating the project

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USER TOKENS TABLE
-- Stores OAuth tokens for Google Business Profile
-- ============================================
CREATE TABLE IF NOT EXISTS user_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT UNIQUE NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_type TEXT DEFAULT 'Bearer',
  scope TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  expiry_date BIGINT, -- Unix timestamp for compatibility
  user_info JSONB, -- Store user info from OAuth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_user_tokens_user_id ON user_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tokens_expires_at ON user_tokens(expires_at);

-- ============================================
-- SUBSCRIPTIONS TABLE
-- User subscription and billing information
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  gbp_account_id TEXT NOT NULL UNIQUE,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'trial',
  plan_id TEXT,
  profile_count INTEGER DEFAULT 0,
  trial_start_date TIMESTAMP WITH TIME ZONE,
  trial_end_date TIMESTAMP WITH TIME ZONE,
  subscription_start_date TIMESTAMP WITH TIME ZONE,
  subscription_end_date TIMESTAMP WITH TIME ZONE,
  last_payment_date TIMESTAMP WITH TIME ZONE,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  amount DECIMAL(10, 2),
  currency TEXT DEFAULT 'INR',
  paid_at TIMESTAMP WITH TIME ZONE,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_gbp_account_id ON subscriptions(gbp_account_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);

-- ============================================
-- PAYMENT HISTORY TABLE
-- Transaction records for all payments
-- ============================================
CREATE TABLE IF NOT EXISTS payment_history (
  id TEXT PRIMARY KEY,
  subscription_id TEXT REFERENCES subscriptions(id) ON DELETE CASCADE,
  amount DECIMAL(10, 2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT NOT NULL,
  razorpay_payment_id TEXT,
  razorpay_order_id TEXT,
  razorpay_signature TEXT,
  description TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payment_history_subscription_id ON payment_history(subscription_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_razorpay_payment_id ON payment_history(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_history_status ON payment_history(status);

-- ============================================
-- USER GBP MAPPING TABLE
-- Maps Firebase User IDs to GBP Account IDs
-- ============================================
CREATE TABLE IF NOT EXISTS user_gbp_mapping (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  gbp_account_id TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, gbp_account_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_gbp_mapping_user_id ON user_gbp_mapping(user_id);
CREATE INDEX IF NOT EXISTS idx_user_gbp_mapping_gbp_account_id ON user_gbp_mapping(gbp_account_id);

-- ============================================
-- AUDIT LOGS TABLE
-- Track admin actions and system events
-- ============================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_email TEXT NOT NULL,
  action TEXT NOT NULL,
  target_user_email TEXT,
  target_user_id TEXT,
  details JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_email ON audit_logs(admin_email);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- ============================================
-- AUDIT RESULTS TABLE
-- SEO audit results for GBP profiles
-- ============================================
CREATE TABLE IF NOT EXISTS audit_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id TEXT NOT NULL,
  user_id TEXT,
  audit_data JSONB NOT NULL,
  score INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_results_location_id ON audit_results(location_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_user_id ON audit_results(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_results_created_at ON audit_results(created_at DESC);

-- ============================================
-- AUTOMATION SETTINGS TABLE
-- User automation preferences
-- ============================================
CREATE TABLE IF NOT EXISTS automation_settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  enabled BOOLEAN DEFAULT false,
  auto_reply_enabled BOOLEAN DEFAULT false,
  reply_tone TEXT DEFAULT 'professional',
  reply_language TEXT DEFAULT 'en',
  custom_instructions TEXT,
  settings JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, location_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_settings_user_id ON automation_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_settings_location_id ON automation_settings(location_id);
CREATE INDEX IF NOT EXISTS idx_automation_settings_enabled ON automation_settings(enabled);

-- ============================================
-- AUTOMATION LOGS TABLE
-- Track automation activity
-- ============================================
CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  review_id TEXT,
  status TEXT NOT NULL,
  details JSONB,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_automation_logs_user_id ON automation_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_location_id ON automation_logs(location_id);
CREATE INDEX IF NOT EXISTS idx_automation_logs_created_at ON automation_logs(created_at DESC);

-- ============================================
-- QR CODES TABLE
-- Generated QR codes for review links
-- ============================================
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  location_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  place_id TEXT,
  qr_data_url TEXT,
  review_link TEXT,
  scans INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_location_id ON qr_codes(location_id);

-- ============================================
-- COUPONS TABLE
-- Discount coupons
-- ============================================
CREATE TABLE IF NOT EXISTS coupons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  discount_type TEXT NOT NULL, -- 'percentage' or 'fixed'
  discount_value DECIMAL(10, 2) NOT NULL,
  max_uses INTEGER,
  used_count INTEGER DEFAULT 0,
  valid_from TIMESTAMP WITH TIME ZONE,
  valid_until TIMESTAMP WITH TIME ZONE,
  applicable_plans TEXT[], -- Array of plan IDs
  is_active BOOLEAN DEFAULT true,
  single_use BOOLEAN DEFAULT false,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);

-- ============================================
-- COUPON USAGE TABLE
-- Track coupon usage by users
-- ============================================
CREATE TABLE IF NOT EXISTS coupon_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  coupon_code TEXT NOT NULL,
  user_id TEXT NOT NULL,
  subscription_id TEXT,
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(coupon_code, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_coupon_usage_coupon_code ON coupon_usage(coupon_code);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);

-- ============================================
-- TOKEN FAILURES TABLE
-- Track token refresh failures for debugging
-- ============================================
CREATE TABLE IF NOT EXISTS token_failures (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  error_type TEXT NOT NULL,
  error_message TEXT,
  error_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_token_failures_user_id ON token_failures(user_id);
CREATE INDEX IF NOT EXISTS idx_token_failures_created_at ON token_failures(created_at DESC);

-- ============================================
-- AUTOMATIC TIMESTAMP UPDATES
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_user_tokens_updated_at BEFORE UPDATE ON user_tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_automation_settings_updated_at BEFORE UPDATE ON automation_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_coupons_updated_at BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- ROW LEVEL SECURITY (RLS) - Optional
-- Uncomment these if you want to use Supabase RLS
-- ============================================

-- Enable RLS on tables
-- ALTER TABLE user_tokens ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- Create policies (example - customize based on your needs)
-- CREATE POLICY "Users can view their own tokens" ON user_tokens
--   FOR SELECT USING (auth.uid()::text = user_id);

-- CREATE POLICY "Users can view their own subscriptions" ON subscriptions
--   FOR SELECT USING (auth.uid()::text = user_id);

-- ============================================
-- VIEWS FOR COMMON QUERIES
-- ============================================

-- Active subscriptions view
CREATE OR REPLACE VIEW active_subscriptions AS
SELECT 
  s.*,
  COALESCE(
    (SELECT json_agg(ph ORDER BY ph.created_at DESC)
     FROM payment_history ph 
     WHERE ph.subscription_id = s.id),
    '[]'::json
  ) as payment_history
FROM subscriptions s
WHERE s.status = 'active' 
  AND (s.subscription_end_date IS NULL OR s.subscription_end_date > NOW());

-- User subscription summary
CREATE OR REPLACE VIEW user_subscription_summary AS
SELECT 
  s.user_id,
  COUNT(DISTINCT s.id) as total_subscriptions,
  COUNT(DISTINCT CASE WHEN s.status = 'active' THEN s.id END) as active_subscriptions,
  SUM(s.profile_count) as total_profiles,
  MAX(s.subscription_end_date) as latest_subscription_end
FROM subscriptions s
GROUP BY s.user_id;

-- ============================================
-- SEED DATA (Optional - for testing)
-- ============================================

-- You can add initial data here if needed
-- INSERT INTO coupons (code, discount_type, discount_value, max_uses, is_active, created_by)
-- VALUES ('WELCOME10', 'percentage', 10, 100, true, 'system');

-- ============================================
-- GRANT PERMISSIONS
-- Grant necessary permissions for the service role
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- ============================================
-- SCHEMA COMPLETE
-- ============================================

COMMENT ON TABLE user_tokens IS 'OAuth tokens for Google Business Profile API';
COMMENT ON TABLE subscriptions IS 'User subscriptions and billing information';
COMMENT ON TABLE payment_history IS 'Transaction history for all payments';
COMMENT ON TABLE user_gbp_mapping IS 'Maps Firebase users to GBP accounts';
COMMENT ON TABLE audit_logs IS 'Admin action and system event logs';
COMMENT ON TABLE audit_results IS 'SEO audit results for GBP profiles';
COMMENT ON TABLE automation_settings IS 'User automation preferences and settings';
COMMENT ON TABLE automation_logs IS 'Automation activity tracking';
COMMENT ON TABLE qr_codes IS 'Generated QR codes for review links';
COMMENT ON TABLE coupons IS 'Discount coupons for subscriptions';
COMMENT ON TABLE coupon_usage IS 'Coupon usage tracking';
COMMENT ON TABLE token_failures IS 'OAuth token refresh failure logs';

