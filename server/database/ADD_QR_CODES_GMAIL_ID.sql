-- Migration: Add gmail_id column to qr_codes table
-- Run this in Supabase SQL Editor if you already have the qr_codes table

-- Add gmail_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'qr_codes' AND column_name = 'gmail_id'
  ) THEN
    ALTER TABLE qr_codes ADD COLUMN gmail_id TEXT;
    RAISE NOTICE 'Added gmail_id column to qr_codes table';
  ELSE
    RAISE NOTICE 'gmail_id column already exists in qr_codes table';
  END IF;
END $$;

-- Create index on gmail_id if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_qr_codes_gmail_id ON qr_codes(gmail_id);

-- Add trigger for updated_at if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_qr_codes_updated_at'
  ) THEN
    CREATE TRIGGER update_qr_codes_updated_at BEFORE UPDATE ON qr_codes
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    RAISE NOTICE 'Added update_qr_codes_updated_at trigger';
  ELSE
    RAISE NOTICE 'update_qr_codes_updated_at trigger already exists';
  END IF;
END $$;

-- Verify the changes
SELECT
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'qr_codes'
ORDER BY ordinal_position;
