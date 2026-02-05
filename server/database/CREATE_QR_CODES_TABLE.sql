-- Create qr_codes table from scratch
-- Run this in Supabase SQL Editor

-- Create the qr_codes table
CREATE TABLE IF NOT EXISTS qr_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL,
  location_id TEXT NOT NULL,
  location_name TEXT,
  address TEXT,
  user_id TEXT NOT NULL,
  gmail_id TEXT,
  place_id TEXT,
  qr_data_url TEXT,
  review_link TEXT,
  public_review_url TEXT,
  keywords TEXT,
  business_category TEXT,
  scans INTEGER DEFAULT 0,
  last_scanned_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_qr_codes_code ON qr_codes(code);
CREATE INDEX IF NOT EXISTS idx_qr_codes_user_id ON qr_codes(user_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_location_id ON qr_codes(location_id);
CREATE INDEX IF NOT EXISTS idx_qr_codes_gmail_id ON qr_codes(gmail_id);

-- Create function for updating updated_at timestamp (if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_qr_codes_updated_at ON qr_codes;
CREATE TRIGGER update_qr_codes_updated_at
BEFORE UPDATE ON qr_codes
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON qr_codes TO postgres, anon, authenticated, service_role;

-- Add comment
COMMENT ON TABLE qr_codes IS 'Generated QR codes for review links';

-- Verify table was created
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'qr_codes'
ORDER BY ordinal_position;

-- Show success message
DO $$
BEGIN
  RAISE NOTICE '✅ qr_codes table created successfully!';
END $$;
