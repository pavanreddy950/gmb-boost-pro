-- ============================================================================
-- ADD QR_CODES TABLE TO EXISTING DATABASE
-- ============================================================================
-- Run this script to add the qr_codes table if it doesn't exist
-- This preserves all existing data in users and user_locations tables
-- ============================================================================

-- Create qr_codes table if it doesn't exist
CREATE TABLE IF NOT EXISTS qr_codes (
  -- PRIMARY KEY
  code TEXT PRIMARY KEY,                    -- Location ID (same as location_id)

  -- LINK TO USER
  gmail_id TEXT,                            -- User's Gmail (references users.gmail_id)
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

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_qr_codes_gmail_id ON qr_codes(gmail_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_location_id ON qr_codes(location_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);

-- Add trigger for updated_at (only if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_qr_codes_updated_at'
  ) THEN
    CREATE TRIGGER update_qr_codes_updated_at
    BEFORE UPDATE ON qr_codes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

-- Add comments
COMMENT ON TABLE qr_codes IS 'QR codes for Ask for Reviews feature - ONE per location';
COMMENT ON COLUMN qr_codes.code IS 'PRIMARY KEY - Same as location_id';
COMMENT ON COLUMN qr_codes.keywords IS 'User-entered keywords for AI review generation';
COMMENT ON COLUMN qr_codes.review_link IS 'Google review link (g.page or search.google.com/writereview)';

-- Verify table was created
SELECT 'qr_codes table created successfully!' as status;
