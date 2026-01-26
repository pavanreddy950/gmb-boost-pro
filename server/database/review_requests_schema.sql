-- Review Requests Feature - Database Schema
-- Run this in your Supabase SQL Editor

-- ============================================
-- REVIEW REQUESTS TABLE
-- Stores uploaded customer data, files, and email tracking
-- ============================================
CREATE TABLE IF NOT EXISTS review_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User & Location Info
  user_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  location_name TEXT,

  -- Business Info for Email Personalization
  business_name TEXT NOT NULL,
  custom_sender_name TEXT, -- Optional override for sender name
  review_link TEXT, -- Google review link for this location

  -- Customer Info
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  customer_phone TEXT,

  -- File Upload Info (stores the original file reference)
  upload_batch_id UUID, -- Groups customers from same file upload
  original_file_name TEXT,
  original_file_type TEXT, -- 'csv', 'xlsx', 'pdf'
  row_number INTEGER, -- Row number in original file

  -- Review Status
  has_reviewed BOOLEAN DEFAULT false,
  review_date TIMESTAMP WITH TIME ZONE,
  review_rating INTEGER,
  review_text TEXT,

  -- Email Tracking
  email_status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'bounced', 'opened'
  email_sent_at TIMESTAMP WITH TIME ZONE,
  email_sent_from TEXT, -- Which Gmail was used to send
  email_message_id TEXT,
  email_error TEXT,
  email_opened_at TIMESTAMP WITH TIME ZONE,
  email_clicked_at TIMESTAMP WITH TIME ZONE,

  -- Duplicate Prevention
  last_request_sent_at TIMESTAMP WITH TIME ZONE,
  request_count INTEGER DEFAULT 0, -- How many times we've sent request

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_review_requests_user_id ON review_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_location_id ON review_requests(location_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_upload_batch_id ON review_requests(upload_batch_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_customer_email ON review_requests(customer_email);
CREATE INDEX IF NOT EXISTS idx_review_requests_email_status ON review_requests(email_status);
CREATE INDEX IF NOT EXISTS idx_review_requests_has_reviewed ON review_requests(has_reviewed);

-- Unique constraint to prevent duplicate customers per location
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_customer_per_location
ON review_requests(user_id, location_id, customer_email);

-- ============================================
-- REVIEW REQUEST BATCHES TABLE
-- Tracks file uploads and batch operations
-- ============================================
CREATE TABLE IF NOT EXISTS review_request_batches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User & Location Info
  user_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  location_name TEXT,
  business_name TEXT,

  -- File Info
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL, -- 'csv', 'xlsx', 'pdf'
  file_size INTEGER, -- Size in bytes

  -- Batch Stats
  total_customers INTEGER DEFAULT 0,
  valid_customers INTEGER DEFAULT 0,
  duplicate_customers INTEGER DEFAULT 0,
  invalid_rows INTEGER DEFAULT 0,
  customers_with_reviews INTEGER DEFAULT 0,
  customers_without_reviews INTEGER DEFAULT 0,

  -- Email Send Stats
  emails_sent INTEGER DEFAULT 0,
  emails_failed INTEGER DEFAULT 0,
  emails_pending INTEGER DEFAULT 0,

  -- Status
  status TEXT DEFAULT 'uploaded', -- 'uploaded', 'processing', 'analyzed', 'sending', 'completed', 'failed'
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_review_request_batches_user_id ON review_request_batches(user_id);
CREATE INDEX IF NOT EXISTS idx_review_request_batches_location_id ON review_request_batches(location_id);
CREATE INDEX IF NOT EXISTS idx_review_request_batches_status ON review_request_batches(status);

-- ============================================
-- EMAIL POOL TRACKING TABLE
-- Tracks daily email usage per Gmail account
-- ============================================
CREATE TABLE IF NOT EXISTS email_pool_usage (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  email_account TEXT NOT NULL, -- Gmail account
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  emails_sent INTEGER DEFAULT 0,
  daily_limit INTEGER DEFAULT 500,

  -- Reset tracking
  last_reset_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(email_account, date)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_email_pool_usage_date ON email_pool_usage(date);
CREATE INDEX IF NOT EXISTS idx_email_pool_usage_email ON email_pool_usage(email_account);

-- ============================================
-- FUNCTION: Update timestamp on record update
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for auto-updating updated_at
DROP TRIGGER IF EXISTS update_review_requests_updated_at ON review_requests;
CREATE TRIGGER update_review_requests_updated_at
  BEFORE UPDATE ON review_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_review_request_batches_updated_at ON review_request_batches;
CREATE TRIGGER update_review_request_batches_updated_at
  BEFORE UPDATE ON review_request_batches
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
