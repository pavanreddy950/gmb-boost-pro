import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const USER_ID = 'eWw8jjayQcSKN8uk9GLyNg49lMn2';
const GBP_ACCOUNT_ID = '17683209108307525705';

console.log('========================================');
console.log('🔍 CHECKING YOUR CURRENT ACCOUNT');
console.log('========================================\n');
console.log(`User ID: ${USER_ID}`);
console.log(`GBP Account ID: ${GBP_ACCOUNT_ID}\n`);

async function checkAccount() {
  try {
    // Get subscription for this specific GBP account
    const { data: subscription, error } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('gbp_account_id', GBP_ACCOUNT_ID)
      .single();

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!subscription) {
      console.log('⚠️ No subscription found for this GBP Account ID');
      return;
    }

    console.log('✅ SUBSCRIPTION FOUND:\n');
    console.log('📊 Current Database Values:');
    console.log(`   - User ID: ${subscription.user_id}`);
    console.log(`   - GBP Account ID: ${subscription.gbp_account_id}`);
    console.log(`   - Status: ${subscription.status}`);
    console.log(`   - Profile Count: ${subscription.profile_count || 0} ⚠️`);
    console.log(`   - Plan ID: ${subscription.plan_id || 'NULL ⚠️'}`);
    console.log(`   - Plan Name: ${subscription.plan_name || 'NULL ⚠️'}`);
    console.log(`   - Max Profiles: ${subscription.max_profiles || 'NULL'}`);
    console.log('');
    console.log('💰 Payment Info:');
    console.log(`   - Amount: ${subscription.amount || 0} ${subscription.currency || 'INR'}`);
    console.log(`   - Payment ID: ${subscription.razorpay_payment_id || 'NONE'}`);
    console.log(`   - Order ID: ${subscription.razorpay_order_id || 'NONE'}`);
    console.log('');
    console.log('📅 Dates:');
    console.log(`   - Created: ${subscription.created_at}`);
    console.log(`   - Updated: ${subscription.updated_at}`);
    console.log(`   - Start: ${subscription.subscription_start_date || 'N/A'}`);
    console.log(`   - End: ${subscription.subscription_end_date || 'N/A'}`);
    console.log('');

    // Check if this is correct
    const issues = [];

    if (!subscription.profile_count || subscription.profile_count < 2) {
      issues.push(`❌ Profile count is ${subscription.profile_count || 0} but you have 2 Google Business accounts`);
    }

    if (!subscription.plan_id) {
      issues.push('❌ Plan ID is NULL (should be "per_profile_yearly")');
    }

    if (!subscription.plan_name) {
      issues.push('❌ Plan Name is NULL');
    }

    if (issues.length > 0) {
      console.log('========================================');
      console.log('🚨 ISSUES FOUND:');
      console.log('========================================\n');
      issues.forEach(issue => console.log(`   ${issue}`));
      console.log('');
      console.log('🔧 I can fix this by updating:');
      console.log(`   - profile_count = 10 (or whatever you selected)`);
      console.log(`   - plan_id = "per_profile_yearly"`);
      console.log(`   - plan_name = "Per Profile Yearly - 10 Profiles"`);
      console.log('');
    } else {
      console.log('✅ Subscription looks correct!\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkAccount().then(() => {
  console.log('Check complete!');
  process.exit(0);
});
