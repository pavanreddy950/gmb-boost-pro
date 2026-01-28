-- ============================================================================
-- LOCATION_PHOTOS TABLE - Photo Dump Feature
-- ============================================================================
-- Follows the same pattern as users + user_locations tables
-- Organized by gmail_id for easy user lookups
-- One table to track: which user, which location, how many photos
-- ============================================================================

-- Create the location_photos table
CREATE TABLE IF NOT EXISTS location_photos (
  -- PRIMARY KEY
  id SERIAL PRIMARY KEY,

  -- LINK TO USER (Same pattern as user_locations)
  gmail_id TEXT NOT NULL REFERENCES users(gmail_id) ON DELETE CASCADE,

  -- LINK TO LOCATION
  location_id TEXT NOT NULL,
  business_name TEXT,                        -- Cached for easy display

  -- PHOTO INFO
  photo_id TEXT NOT NULL UNIQUE,             -- Unique ID (UUID) for this photo
  original_filename TEXT,                    -- Original uploaded filename
  storage_path TEXT NOT NULL,                -- Path in Supabase Storage
  public_url TEXT,                           -- Public URL for GBP API

  -- SIZE INFO (For compression tracking)
  original_size_bytes INTEGER,               -- Size before compression
  compressed_size_bytes INTEGER,             -- Size after compression (target: 50-100KB)
  compression_ratio DECIMAL(5,2),            -- e.g., 0.35 = 65% smaller

  -- FORMAT INFO
  mime_type TEXT DEFAULT 'image/webp',       -- image/webp preferred
  width INTEGER,
  height INTEGER,

  -- QUEUE POSITION & STATUS
  queue_position INTEGER NOT NULL,           -- 1, 2, 3... (order in queue, max 60)
  status TEXT DEFAULT 'pending',             -- 'pending', 'used', 'failed'

  -- USAGE TRACKING
  used_at TIMESTAMPTZ,                       -- When photo was attached to post
  used_in_post_id TEXT,                      -- Which GBP post used this photo
  error_message TEXT,                        -- Error if posting failed

  -- TIMESTAMPS
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- INDEXES for fast queries
-- ============================================================================

-- Find all photos for a user
CREATE INDEX IF NOT EXISTS idx_location_photos_gmail_id
  ON location_photos(gmail_id);

-- Find photos for a specific location
CREATE INDEX IF NOT EXISTS idx_location_photos_location_id
  ON location_photos(location_id);

-- Find photos for a user's specific location (most common query)
CREATE INDEX IF NOT EXISTS idx_location_photos_gmail_location
  ON location_photos(gmail_id, location_id);

-- Filter by status
CREATE INDEX IF NOT EXISTS idx_location_photos_status
  ON location_photos(status);

-- Get next pending photo in queue (used by auto-posting)
CREATE INDEX IF NOT EXISTS idx_location_photos_pending_queue
  ON location_photos(location_id, queue_position)
  WHERE status = 'pending';

-- ============================================================================
-- TRIGGER for auto-updating updated_at
-- ============================================================================

CREATE TRIGGER update_location_photos_updated_at
BEFORE UPDATE ON location_photos
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE location_photos IS 'Photo dump storage - per location photo queue for auto-posting (max 60 photos per location)';
COMMENT ON COLUMN location_photos.gmail_id IS 'Links to users.gmail_id - same pattern as user_locations';
COMMENT ON COLUMN location_photos.location_id IS 'GBP location ID - which business location these photos belong to';
COMMENT ON COLUMN location_photos.queue_position IS 'Order in which photos will be used (1 = next, max 60)';
COMMENT ON COLUMN location_photos.status IS 'pending = waiting to be used, used = attached to post and deleted, failed = post failed (will retry)';
COMMENT ON COLUMN location_photos.compression_ratio IS 'Ratio of compressed/original size. 0.35 means 65% size reduction';
COMMENT ON COLUMN location_photos.public_url IS 'Publicly accessible URL required for GBP API media attachment';

-- ============================================================================
-- USEFUL QUERIES (For reference)
-- ============================================================================

-- 1. Get all photos for a user with counts per location
-- SELECT
--   location_id,
--   business_name,
--   COUNT(*) as total_photos,
--   COUNT(CASE WHEN status = 'pending' THEN 1 END) as remaining_photos,
--   COUNT(CASE WHEN status = 'used' THEN 1 END) as used_photos
-- FROM location_photos
-- WHERE gmail_id = 'user@gmail.com'
-- GROUP BY location_id, business_name;

-- 2. Get next photo to use for auto-posting
-- SELECT * FROM location_photos
-- WHERE location_id = '123456789' AND status = 'pending'
-- ORDER BY queue_position ASC
-- LIMIT 1;

-- 3. Get remaining days for a location (pending photos = remaining days)
-- SELECT COUNT(*) as days_remaining
-- FROM location_photos
-- WHERE location_id = '123456789' AND status = 'pending';

-- 4. Get storage usage per user
-- SELECT
--   gmail_id,
--   COUNT(*) as total_photos,
--   SUM(compressed_size_bytes) / 1024 / 1024 as total_mb,
--   AVG(compression_ratio) as avg_compression
-- FROM location_photos
-- GROUP BY gmail_id;
