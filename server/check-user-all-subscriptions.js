import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const USER_ID = 'eWw8jjayQcSKN8uk9GLyNg49lMn2';

console.log('========================================');
console.log('🔍 CHECKING ALL SUBSCRIPTIONS FOR USER');
console.log('========================================\n');
console.log(`User ID: ${USER_ID}\n`);

async function checkAllUserSubscriptions() {
  try {
    // Get ALL subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', USER_ID)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found for this User ID');
      return;
    }

    console.log(`✅ FOUND ${subscriptions.length} SUBSCRIPTION(S):\n`);

    subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. GBP Account: ${sub.gbp_account_id}`);
      console.log('========================================');
      console.log(`📊 Status: ${sub.status}`);
      console.log(`📊 Profile Count: ${sub.profile_count || 0} ${!sub.profile_count ? '⚠️ NULL' : ''}`);
      console.log(`📊 Plan ID: ${sub.plan_id || 'NULL ⚠️'}`);
      console.log(`📊 Plan Name: ${sub.plan_name || 'NULL ⚠️'}`);
      console.log(`📊 Max Profiles: ${sub.max_profiles || 'NULL'}`);
      console.log('');
      console.log(`💰 Amount: ${sub.amount || 0} ${sub.currency || 'INR'}`);
      console.log(`💰 Payment ID: ${sub.razorpay_payment_id || 'NONE'}`);
      console.log(`💰 Order ID: ${sub.razorpay_order_id || 'NONE'}`);
      console.log('');
      console.log(`📅 Created: ${sub.created_at}`);
      console.log(`📅 Updated: ${sub.updated_at}`);
      console.log(`📅 Start: ${sub.subscription_start_date || 'N/A'}`);
      console.log(`📅 End: ${sub.subscription_end_date || 'N/A'}`);
      console.log('========================================\n');
    });

    // Check for the specific GBP account we're looking for
    const targetGbp = '17683209108307525705';
    const targetSub = subscriptions.find(s => s.gbp_account_id === targetGbp);

    if (targetSub) {
      console.log(`🎯 FOUND TARGET ACCOUNT: ${targetGbp}\n`);
      console.log('This is the account that just made a payment.');
      console.log(`Payment ID: ${targetSub.razorpay_payment_id || 'NONE'}`);
      console.log(`Profile Count: ${targetSub.profile_count || 0}\n`);
    } else {
      console.log(`⚠️ TARGET ACCOUNT ${targetGbp} NOT FOUND\n`);
      console.log('The payment may have been recorded under a different GBP Account ID.');
      console.log('Check the most recently updated subscription above.\n');
    }

    // Highlight issues
    const issues = [];
    subscriptions.forEach(sub => {
      if (!sub.profile_count || sub.profile_count === 0) {
        issues.push(`GBP ${sub.gbp_account_id}: profile_count is ${sub.profile_count || 0}`);
      }
      if (!sub.plan_id) {
        issues.push(`GBP ${sub.gbp_account_id}: plan_id is NULL`);
      }
    });

    if (issues.length > 0) {
      console.log('========================================');
      console.log('🚨 ISSUES FOUND:');
      console.log('========================================\n');
      issues.forEach(issue => console.log(`   ❌ ${issue}`));
      console.log('\n');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAllUserSubscriptions().then(() => {
  console.log('Check complete!');
  process.exit(0);
});
