import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkEndDates() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING SUBSCRIPTION END DATES IN DATABASE');
  console.log('='.repeat(80));
  console.log('');

  // Get all subscriptions
  const { data: subscriptions, error } = await supabase
    .from('subscriptions')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching subscriptions:', error.message);
    return;
  }

  console.log(`📊 Total subscriptions: ${subscriptions.length}`);
  console.log('');

  let missingTrialEnd = 0;
  let missingSubEnd = 0;
  let hasTrialEnd = 0;
  let hasSubEnd = 0;

  console.log('📋 SUBSCRIPTION DETAILS:');
  console.log('-'.repeat(80));

  for (const sub of subscriptions) {
    console.log(`\n🆔 Subscription ID: ${sub.id}`);
    console.log(`   User ID: ${sub.user_id}`);
    console.log(`   GBP Account: ${sub.gbp_account_id || 'N/A'}`);
    console.log(`   Status: ${sub.status}`);
    console.log(`   Type: ${sub.subscription_type || 'NOT SET'}`);
    console.log(`   Is Trial: ${sub.is_trial ? 'Yes' : 'No'}`);
    console.log(`   Created: ${new Date(sub.created_at).toLocaleString()}`);

    // Check trial_end_date
    if (sub.trial_end_date) {
      console.log(`   ✅ Trial End Date: ${new Date(sub.trial_end_date).toLocaleString()}`);
      hasTrialEnd++;
    } else {
      console.log(`   ❌ Trial End Date: NOT SET`);
      missingTrialEnd++;
    }

    // Check subscription_end_date (NOT current_period_end!)
    if (sub.subscription_end_date) {
      console.log(`   ✅ Subscription End Date: ${new Date(sub.subscription_end_date).toLocaleString()}`);
      hasSubEnd++;
    } else {
      console.log(`   ❌ Subscription End Date: NOT SET`);
      missingSubEnd++;
    }

    // Check Razorpay data
    if (sub.razorpay_subscription_id) {
      console.log(`   💳 Razorpay Sub ID: ${sub.razorpay_subscription_id}`);
    }
    if (sub.razorpay_plan_id) {
      console.log(`   💳 Razorpay Plan ID: ${sub.razorpay_plan_id}`);
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('📊 SUMMARY:');
  console.log('-'.repeat(80));
  console.log(`Total subscriptions: ${subscriptions.length}`);
  console.log('');
  console.log('Trial End Date:');
  console.log(`   ✅ Has trial_end_date: ${hasTrialEnd}`);
  console.log(`   ❌ Missing trial_end_date: ${missingTrialEnd}`);
  console.log('');
  console.log('Subscription End Date:');
  console.log(`   ✅ Has subscription_end_date: ${hasSubEnd}`);
  console.log(`   ❌ Missing subscription_end_date: ${missingSubEnd}`);
  console.log('');

  if (missingTrialEnd > 0 || missingSubEnd > 0) {
    console.log('⚠️  PROBLEM FOUND:');
    console.log('   End dates are NOT being saved properly to the database!');
    console.log('   This is why the subscription guard is failing.');
    console.log('');
    console.log('🔧 NEED TO FIX:');
    console.log('   1. Check subscription creation code (trial & payment)');
    console.log('   2. Ensure trial_end_date is calculated and saved');
    console.log('   3. Ensure subscription_end_date is saved from Razorpay webhook');
  } else {
    console.log('✅ All subscriptions have proper end dates!');
  }

  console.log('='.repeat(80));
}

checkEndDates().catch(console.error);
