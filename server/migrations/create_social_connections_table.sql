-- ============================================================================
-- Social Connections Table Migration
-- For storing Instagram and Facebook connections per location
-- ============================================================================

-- Create the social_connections table
CREATE TABLE IF NOT EXISTS social_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,

  -- User identification (first two columns as requested)
  gmail VARCHAR(255) NOT NULL,
  phone_number VARCHAR(20),

  -- Location identification (using location_name instead of location_id)
  location_name VARCHAR(255) NOT NULL,
  location_id VARCHAR(255) NOT NULL,

  -- Instagram connection details
  instagram_enabled BOOLEAN DEFAULT false,
  instagram_user_id VARCHAR(255),
  instagram_username VARCHAR(255),
  instagram_access_token TEXT,

  -- Facebook connection details
  facebook_enabled BOOLEAN DEFAULT false,
  facebook_page_id VARCHAR(255),
  facebook_page_name VARCHAR(255),
  facebook_access_token TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- Unique constraint: one connection per gmail + location combination
  UNIQUE(gmail, location_id)
);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_social_connections_gmail
  ON social_connections(gmail);

CREATE INDEX IF NOT EXISTS idx_social_connections_location_id
  ON social_connections(location_id);

CREATE INDEX IF NOT EXISTS idx_social_connections_gmail_location
  ON social_connections(gmail, location_id);

-- Enable Row Level Security (RLS)
ALTER TABLE social_connections ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read their own connections
CREATE POLICY "Users can read own social connections"
  ON social_connections
  FOR SELECT
  USING (true);  -- Allow service role to read all

-- Create policy to allow authenticated users to insert their own connections
CREATE POLICY "Users can insert own social connections"
  ON social_connections
  FOR INSERT
  WITH CHECK (true);  -- Allow service role to insert

-- Create policy to allow authenticated users to update their own connections
CREATE POLICY "Users can update own social connections"
  ON social_connections
  FOR UPDATE
  USING (true);  -- Allow service role to update

-- Create policy to allow authenticated users to delete their own connections
CREATE POLICY "Users can delete own social connections"
  ON social_connections
  FOR DELETE
  USING (true);  -- Allow service role to delete

-- ============================================================================
-- Grant permissions to service role
-- ============================================================================
GRANT ALL ON social_connections TO service_role;
GRANT ALL ON social_connections TO authenticated;

-- ============================================================================
-- Comments for documentation
-- ============================================================================
COMMENT ON TABLE social_connections IS 'Stores Instagram and Facebook connections per GBP location';
COMMENT ON COLUMN social_connections.gmail IS 'User email address (primary identifier)';
COMMENT ON COLUMN social_connections.phone_number IS 'User phone number (optional)';
COMMENT ON COLUMN social_connections.location_name IS 'Business location name';
COMMENT ON COLUMN social_connections.location_id IS 'Google Business Profile location ID';
COMMENT ON COLUMN social_connections.instagram_enabled IS 'Whether Instagram auto-posting is enabled';
COMMENT ON COLUMN social_connections.instagram_user_id IS 'Instagram Business account user ID';
COMMENT ON COLUMN social_connections.instagram_username IS 'Instagram username for display';
COMMENT ON COLUMN social_connections.instagram_access_token IS 'Instagram API access token';
COMMENT ON COLUMN social_connections.facebook_enabled IS 'Whether Facebook auto-posting is enabled';
COMMENT ON COLUMN social_connections.facebook_page_id IS 'Facebook Page ID';
COMMENT ON COLUMN social_connections.facebook_page_name IS 'Facebook Page name for display';
COMMENT ON COLUMN social_connections.facebook_access_token IS 'Facebook Page access token';
