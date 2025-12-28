import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const razorpayKeyId = process.env.RAZORPAY_KEY_ID;
const razorpayKeySecret = process.env.RAZORPAY_KEY_SECRET;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

if (!razorpayKeyId || !razorpayKeySecret) {
  console.error('❌ Missing RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const razorpay = new Razorpay({
  key_id: razorpayKeyId,
  key_secret: razorpayKeySecret
});

async function backfillEndDates() {
  console.log('='.repeat(80));
  console.log('🔧 BACKFILLING SUBSCRIPTION END DATES FROM RAZORPAY');
  console.log('='.repeat(80));
  console.log('');

  // Get all subscriptions that have a Razorpay subscription ID but missing current_period_end
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .not('razorpay_subscription_id', 'is', null)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching subscriptions:', error.message);
    return;
  }

  console.log(`📊 Found ${subscriptions.length} subscriptions with Razorpay IDs`);
  console.log('');

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const sub of subscriptions) {
    console.log('─'.repeat(80));
    console.log(`\n🔍 Processing subscription: ${sub.id}`);
    console.log(`   User: ${sub.user_id}`);
    console.log(`   GBP Account: ${sub.gbp_account_id || 'N/A'}`);
    console.log(`   Status: ${sub.status}`);
    console.log(`   Razorpay Sub ID: ${sub.razorpay_subscription_id}`);
    console.log(`   Subscription End Date: ${sub.subscription_end_date || 'NOT SET'}`);

    // Skip if already has end date
    if (sub.subscription_end_date) {
      console.log(`   ✅ Already has end date, skipping`);
      skippedCount++;
      continue;
    }

    try {
      // Fetch subscription details from Razorpay
      console.log(`   📡 Fetching from Razorpay...`);
      const razorpaySub = await razorpay.subscriptions.fetch(sub.razorpay_subscription_id);

      console.log(`   📋 Razorpay subscription details:`, {
        id: razorpaySub.id,
        status: razorpaySub.status,
        current_start: razorpaySub.current_start,
        current_end: razorpaySub.current_end,
        paid_count: razorpaySub.paid_count,
        remaining_count: razorpaySub.remaining_count
      });

      // Extract dates (Razorpay timestamps are in SECONDS, not milliseconds)
      const currentStart = razorpaySub.current_start
        ? new Date(razorpaySub.current_start * 1000).toISOString()
        : null;
      const currentEnd = razorpaySub.current_end
        ? new Date(razorpaySub.current_end * 1000).toISOString()
        : null;

      console.log(`   📅 Converted dates:`, {
        current_start_iso: currentStart,
        current_end_iso: currentEnd
      });

      // Update Supabase with the end date
      if (currentEnd) {
        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            subscription_end_date: currentEnd,
            subscription_start_date: currentStart,
            updated_at: new Date().toISOString()
          })
          .eq('id', sub.id);

        if (updateError) {
          console.error(`   ❌ Error updating subscription:`, updateError.message);
          errorCount++;
        } else {
          console.log(`   ✅ Successfully updated with end date: ${currentEnd}`);
          updatedCount++;
        }
      } else {
        console.log(`   ⚠️  Razorpay subscription has no current_end (might be cancelled/expired)`);
        skippedCount++;
      }

    } catch (error) {
      console.error(`   ❌ Error processing subscription:`, error.message);
      if (error.statusCode === 400) {
        console.error(`   Razorpay error: Subscription might not exist or is invalid`);
      }
      errorCount++;
    }

    console.log('');
  }

  console.log('='.repeat(80));
  console.log('📊 BACKFILL SUMMARY:');
  console.log('-'.repeat(80));
  console.log(`Total subscriptions processed: ${subscriptions.length}`);
  console.log(`✅ Successfully updated: ${updatedCount}`);
  console.log(`⏭️  Skipped (already had end date): ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log('='.repeat(80));
  console.log('');

  if (updatedCount > 0) {
    console.log('✅ Backfill complete! Run check-subscription-end-dates.js to verify.');
  } else if (errorCount > 0) {
    console.log('⚠️  Some subscriptions had errors. Please review the output above.');
  } else {
    console.log('ℹ️  All subscriptions already had end dates or were skipped.');
  }
}

backfillEndDates().catch(console.error);
