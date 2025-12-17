-- Migration: Add missing columns to qr_codes table for complete QR code functionality
-- Date: 2025-12-17
-- Description: Add keywords, business_category, location_name, address, public_review_url, and updated_at columns

-- Add keywords column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'keywords') THEN
    ALTER TABLE qr_codes ADD COLUMN keywords TEXT;
    RAISE NOTICE 'Added keywords column';
  END IF;
END $$;

-- Add business_category column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'business_category') THEN
    ALTER TABLE qr_codes ADD COLUMN business_category TEXT;
    RAISE NOTICE 'Added business_category column';
  END IF;
END $$;

-- Add location_name column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'location_name') THEN
    ALTER TABLE qr_codes ADD COLUMN location_name TEXT;
    RAISE NOTICE 'Added location_name column';
  END IF;
END $$;

-- Add address column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'address') THEN
    ALTER TABLE qr_codes ADD COLUMN address TEXT;
    RAISE NOTICE 'Added address column';
  END IF;
END $$;

-- Add public_review_url column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'public_review_url') THEN
    ALTER TABLE qr_codes ADD COLUMN public_review_url TEXT;
    RAISE NOTICE 'Added public_review_url column';
  END IF;
END $$;

-- Add updated_at column
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'qr_codes' AND column_name = 'updated_at') THEN
    ALTER TABLE qr_codes ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    RAISE NOTICE 'Added updated_at column';
  END IF;
END $$;

-- Verify all changes
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'qr_codes'
ORDER BY ordinal_position;
