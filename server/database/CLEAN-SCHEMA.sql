-- ============================================================================
-- CLEAN & SIMPLE DATABASE SCHEMA FOR LOBAISEO
-- ============================================================================
-- This schema uses ONLY 2 TABLES organized by Gmail ID
--
-- TABLE 1: users - Stores user info, subscription, and tokens
-- TABLE 2: user_locations - Links users to their business locations with settings
-- ============================================================================

-- Drop ALL existing tables (clean slate - REMOVE EVERYTHING!)
DROP TABLE IF EXISTS automation_settings CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_tokens CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
DROP TABLE IF EXISTS payment_history CASCADE;
DROP TABLE IF EXISTS user_gbp_mapping CASCADE;
DROP TABLE IF EXISTS token_failures CASCADE;
DROP TABLE IF EXISTS qr_codes CASCADE;
DROP TABLE IF EXISTS leader_election CASCADE;
DROP TABLE IF EXISTS coupons CASCADE;
DROP TABLE IF EXISTS coupon_usage CASCADE;
DROP TABLE IF EXISTS audit_logs CASCADE;
DROP TABLE IF EXISTS audit_results CASCADE;
DROP TABLE IF EXISTS user_locations CASCADE;
DROP TABLE IF EXISTS locations CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================================
-- TABLE 1: USERS (Everything about the user in ONE place!)
-- ============================================================================
CREATE TABLE users (
  -- PRIMARY KEY
  gmail_id TEXT PRIMARY KEY,  -- User's Gmail address (e.g., "scalepointstrategy@gmail.com")

  -- USER INFO
  firebase_uid TEXT,          -- Firebase UID for authentication
  display_name TEXT,          -- User's display name

  -- SUBSCRIPTION STATUS (Shows exactly why user can/cannot use features)
  subscription_status TEXT DEFAULT 'trial',  -- 'trial', 'active', 'expired', 'admin'
  trial_start_date TIMESTAMPTZ DEFAULT NOW(),
  trial_end_date TIMESTAMPTZ,                -- 15 days from trial_start_date
  subscription_start_date TIMESTAMPTZ,       -- When user paid
  subscription_end_date TIMESTAMPTZ,         -- When subscription expires
  profile_count INTEGER DEFAULT 0,           -- Number of profiles user subscribed for

  -- ADMIN FLAG
  is_admin BOOLEAN DEFAULT FALSE,            -- TRUE only for scalepointstrategy@gmail.com

  -- GOOGLE TOKENS (for 24/7 auto-posting)
  google_access_token TEXT,
  google_refresh_token TEXT,
  google_token_expiry BIGINT,                -- Unix timestamp
  google_account_id TEXT,                    -- GBP account ID (e.g., "106433552101751461082")

  -- TOKEN STATUS (Shows if tokens are working)
  has_valid_token BOOLEAN DEFAULT FALSE,     -- TRUE if tokens are working
  token_last_refreshed TIMESTAMPTZ,          -- When was token last refreshed
  token_error TEXT,                          -- Last token error (if any)

  -- PAYMENT INFO
  razorpay_order_id TEXT,
  razorpay_payment_id TEXT,
  razorpay_subscription_id TEXT,
  amount_paid INTEGER DEFAULT 0,             -- Amount in paise (₹199 = 19900 paise)

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- UNIQUE constraint
  UNIQUE(firebase_uid)
);

-- Indexes for fast lookups
CREATE INDEX idx_users_subscription_status ON users(subscription_status);
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_has_valid_token ON users(has_valid_token);

-- ============================================================================
-- TABLE 2: USER_LOCATIONS (Users + Their Business Locations + Settings)
-- ============================================================================
CREATE TABLE user_locations (
  -- PRIMARY KEY
  id SERIAL PRIMARY KEY,

  -- LINK TO USER (Gmail ID makes it easy to find all user's locations)
  gmail_id TEXT NOT NULL REFERENCES users(gmail_id) ON DELETE CASCADE,

  -- LOCATION INFO
  location_id TEXT NOT NULL,                 -- GBP location ID (e.g., "13105974633901693907")
  business_name TEXT,                        -- Business name
  address TEXT,                              -- Full business address
  category TEXT DEFAULT 'business',          -- Business category
  keywords TEXT,                             -- SEO keywords for AI posts

  -- AUTO-POSTING SETTINGS
  autoposting_enabled BOOLEAN DEFAULT FALSE, -- Is auto-posting turned ON?
  autoposting_schedule TEXT DEFAULT '10:00', -- What time to post (e.g., "10:00")
  autoposting_frequency TEXT DEFAULT 'daily',-- How often ('daily', 'weekly', 'monthly')
  autoposting_timezone TEXT DEFAULT 'Asia/Kolkata',

  -- AUTO-POSTING STATUS (Shows WHY auto-posting is on/off)
  autoposting_status TEXT DEFAULT 'disabled', -- 'active', 'disabled', 'blocked_no_subscription', 'blocked_expired_trial', 'blocked_no_token'
  autoposting_status_reason TEXT,             -- Human-readable reason (e.g., "Trial expired on 2026-01-15")

  -- POST TRACKING
  last_post_date TIMESTAMPTZ,                -- When was last post created
  last_post_success BOOLEAN,                 -- Did last post succeed?
  last_post_error TEXT,                      -- Last post error (if any)
  next_post_date TIMESTAMPTZ,                -- When is next post scheduled
  total_posts_created INTEGER DEFAULT 0,     -- Total posts created for this location

  -- AUTO-REPLY SETTINGS
  autoreply_enabled BOOLEAN DEFAULT FALSE,
  autoreply_status TEXT DEFAULT 'disabled',  -- 'active', 'disabled', 'blocked'
  autoreply_status_reason TEXT,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- UNIQUE constraint: One location per user
  UNIQUE(gmail_id, location_id)
);

-- Indexes for fast lookups
CREATE INDEX idx_user_locations_gmail_id ON user_locations(gmail_id);
CREATE INDEX idx_user_locations_location_id ON user_locations(location_id);
CREATE INDEX idx_user_locations_autoposting_enabled ON user_locations(autoposting_enabled);
CREATE INDEX idx_user_locations_autoposting_status ON user_locations(autoposting_status);
CREATE INDEX idx_user_locations_next_post_date ON user_locations(next_post_date);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for users table
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Trigger for user_locations table
CREATE TRIGGER update_user_locations_updated_at
BEFORE UPDATE ON user_locations
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- SAMPLE DATA (Admin user)
-- ============================================================================

-- Insert admin user
INSERT INTO users (
  gmail_id,
  firebase_uid,
  display_name,
  subscription_status,
  is_admin,
  profile_count,
  has_valid_token
) VALUES (
  'scalepointstrategy@gmail.com',
  'admin-uid-123',
  'Scale Point Strategy',
  'admin',
  TRUE,
  999999,
  TRUE
) ON CONFLICT (gmail_id) DO NOTHING;

-- ============================================================================
-- DIAGNOSTIC QUERIES (Find problems easily!)
-- ============================================================================

-- QUERY 1: Get user's full status (subscription, tokens, locations)
-- SELECT
--   u.gmail_id,
--   u.subscription_status,
--   u.trial_end_date,
--   u.subscription_end_date,
--   u.has_valid_token,
--   u.token_error,
--   COUNT(ul.id) as total_locations,
--   COUNT(CASE WHEN ul.autoposting_enabled = TRUE THEN 1 END) as enabled_locations,
--   COUNT(CASE WHEN ul.autoposting_status = 'active' THEN 1 END) as active_locations
-- FROM users u
-- LEFT JOIN user_locations ul ON u.gmail_id = ul.gmail_id
-- WHERE u.gmail_id = 'user@gmail.com'
-- GROUP BY u.gmail_id;

-- QUERY 2: Find ALL locations with auto-posting OFF and WHY
-- SELECT
--   ul.gmail_id,
--   ul.business_name,
--   ul.location_id,
--   ul.autoposting_enabled,
--   ul.autoposting_status,
--   ul.autoposting_status_reason,
--   u.subscription_status,
--   u.has_valid_token,
--   u.token_error
-- FROM user_locations ul
-- JOIN users u ON ul.gmail_id = u.gmail_id
-- WHERE ul.autoposting_status != 'active'
-- ORDER BY ul.gmail_id, ul.business_name;

-- QUERY 3: Find locations where toggle is ON but status is not 'active'
-- (This shows configuration problems!)
-- SELECT
--   ul.gmail_id,
--   ul.business_name,
--   ul.autoposting_enabled,
--   ul.autoposting_status,
--   ul.autoposting_status_reason
-- FROM user_locations ul
-- WHERE ul.autoposting_enabled = TRUE
-- AND ul.autoposting_status != 'active';

-- QUERY 4: Check if user has valid access
-- SELECT
--   gmail_id,
--   subscription_status,
--   is_admin,
--   CASE
--     WHEN is_admin = TRUE THEN 'ADMIN - Unlimited Access'
--     WHEN subscription_status = 'trial' AND trial_end_date > NOW() THEN 'TRIAL ACTIVE - ' || EXTRACT(DAY FROM (trial_end_date - NOW())) || ' days left'
--     WHEN subscription_status = 'trial' AND trial_end_date <= NOW() THEN 'TRIAL EXPIRED on ' || trial_end_date::date
--     WHEN subscription_status = 'active' AND subscription_end_date > NOW() THEN 'SUBSCRIPTION ACTIVE - ' || EXTRACT(DAY FROM (subscription_end_date - NOW())) || ' days left'
--     WHEN subscription_status = 'active' AND subscription_end_date <= NOW() THEN 'SUBSCRIPTION EXPIRED on ' || subscription_end_date::date
--     ELSE 'NO ACCESS - No trial or subscription'
--   END as access_status
-- FROM users WHERE gmail_id = 'user@gmail.com';

-- QUERY 5: Get locations ready for next post
-- SELECT
--   ul.gmail_id,
--   ul.business_name,
--   ul.location_id,
--   ul.next_post_date,
--   ul.autoposting_status,
--   u.has_valid_token
-- FROM user_locations ul
-- JOIN users u ON ul.gmail_id = u.gmail_id
-- WHERE ul.autoposting_status = 'active'
-- AND ul.next_post_date <= NOW()
-- AND u.has_valid_token = TRUE;

-- ============================================================================
-- COMMENTS (Documentation in database)
-- ============================================================================

COMMENT ON TABLE users IS 'Main user table with subscription, tokens, and payment info';
COMMENT ON TABLE user_locations IS 'Links users to their business locations with automation settings';

COMMENT ON COLUMN users.gmail_id IS 'PRIMARY KEY - User Gmail address';
COMMENT ON COLUMN users.subscription_status IS 'trial, active, expired, or admin';
COMMENT ON COLUMN users.is_admin IS 'TRUE only for scalepointstrategy@gmail.com';
COMMENT ON COLUMN users.has_valid_token IS 'TRUE if Google tokens are working (refreshed < 1 hour ago)';

COMMENT ON COLUMN user_locations.gmail_id IS 'Links to users.gmail_id - Find all locations for a user';
COMMENT ON COLUMN user_locations.location_id IS 'GBP location ID from Google';
COMMENT ON COLUMN user_locations.autoposting_enabled IS 'User toggle - TRUE if user wants auto-posting ON';
COMMENT ON COLUMN user_locations.autoposting_status IS 'System status - active/disabled/blocked_no_subscription/blocked_expired_trial/blocked_no_token';
COMMENT ON COLUMN user_locations.autoposting_status_reason IS 'Human-readable reason WHY auto-posting is on/off (for debugging)';

-- ============================================================================
-- TABLE 3: QR_CODES (For "Ask for Reviews" feature)
-- ============================================================================
-- Stores QR codes for each location - ONE QR per user's location
-- Keywords entered here are used for AI review generation
-- ============================================================================
CREATE TABLE qr_codes (
  -- PRIMARY KEY
  code TEXT PRIMARY KEY,                    -- Location ID (same as location_id)

  -- LINK TO USER
  gmail_id TEXT REFERENCES users(gmail_id) ON DELETE CASCADE,
  user_id TEXT,                             -- Firebase UID (for backward compatibility)

  -- LOCATION INFO
  location_id TEXT NOT NULL,
  location_name TEXT,
  address TEXT,
  place_id TEXT,                            -- Google Place ID

  -- QR CODE DATA
  qr_data_url TEXT,                         -- Base64 encoded QR code image
  review_link TEXT,                         -- Google review link (g.page or search.google.com)
  public_review_url TEXT,                   -- Our public review page URL

  -- KEYWORDS FOR AI REVIEWS (This is what you enter in the QR generation form!)
  keywords TEXT,                            -- Comma-separated keywords for AI review suggestions
  business_category TEXT,                   -- Business category from Google Business Profile

  -- TRACKING
  scans INTEGER DEFAULT 0,                  -- Number of times QR was scanned
  last_scanned_at TIMESTAMPTZ,

  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_qr_codes_gmail_id ON qr_codes(gmail_id);
CREATE INDEX idx_qr_codes_location_id ON qr_codes(location_id);
CREATE INDEX idx_qr_codes_user_id ON qr_codes(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_qr_codes_updated_at
BEFORE UPDATE ON qr_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

COMMENT ON TABLE qr_codes IS 'QR codes for Ask for Reviews feature - ONE per location';
COMMENT ON COLUMN qr_codes.code IS 'PRIMARY KEY - Same as location_id';
COMMENT ON COLUMN qr_codes.keywords IS 'User-entered keywords for AI review generation';
COMMENT ON COLUMN qr_codes.review_link IS 'Google review link (g.page or search.google.com/writereview)';
