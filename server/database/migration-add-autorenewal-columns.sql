-- Migration: Add auto-renewal columns to subscriptions table
-- Run this in Supabase SQL Editor to add support for Razorpay auto-renewal subscriptions

-- Add Razorpay subscription ID for recurring payments
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS razorpay_subscription_id TEXT;

-- Add Razorpay customer ID for mandate setup
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS razorpay_customer_id TEXT;

-- Add mandate authorization status
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS mandate_authorized BOOLEAN DEFAULT false;

-- Add mandate token ID for recurring charges
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS mandate_token_id TEXT;

-- Add mandate authorization date
ALTER TABLE subscriptions
ADD COLUMN IF NOT EXISTS mandate_auth_date TIMESTAMP WITH TIME ZONE;

-- Create indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_subscription_id
ON subscriptions(razorpay_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_customer_id
ON subscriptions(razorpay_customer_id);

-- Add comment for documentation
COMMENT ON COLUMN subscriptions.razorpay_subscription_id IS 'Razorpay subscription ID for auto-renewal';
COMMENT ON COLUMN subscriptions.razorpay_customer_id IS 'Razorpay customer ID for mandate payments';
COMMENT ON COLUMN subscriptions.mandate_authorized IS 'Whether the mandate is authorized for auto-debit';
COMMENT ON COLUMN subscriptions.mandate_token_id IS 'Token for recurring mandate charges';
COMMENT ON COLUMN subscriptions.mandate_auth_date IS 'When the mandate was authorized';

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'subscriptions'
AND column_name IN (
  'razorpay_subscription_id',
  'razorpay_customer_id',
  'mandate_authorized',
  'mandate_token_id',
  'mandate_auth_date'
);
