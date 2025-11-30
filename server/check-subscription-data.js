import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env file');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('========================================');
console.log('🔍 SUBSCRIPTION DATA DIAGNOSTIC');
console.log('========================================\n');

async function checkSubscriptions() {
  try {
    // Get all subscriptions from Supabase
    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching subscriptions:', error);
      return;
    }

    console.log(`✅ Found ${subscriptions.length} subscription(s) in database\n`);

    if (subscriptions.length === 0) {
      console.log('⚠️ No subscriptions found in database!');
      return;
    }

    // Display each subscription
    subscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. Subscription Details:`);
      console.log(`   ========================================`);
      console.log(`   User ID: ${sub.user_id || 'N/A'}`);
      console.log(`   GBP Account ID: ${sub.gbp_account_id || 'N/A'}`);
      console.log(`   Plan ID: ${sub.plan_id || 'N/A'}`);
      console.log(`   Plan Name: ${sub.plan_name || 'N/A'}`);
      console.log(`   Status: ${sub.status || 'N/A'}`);
      console.log(`   `);
      console.log(`   💰 PAYMENT INFO:`);
      console.log(`   - Profile Count: ${sub.profile_count || 0} ⚠️`);
      console.log(`   - Max Profiles: ${sub.max_profiles || 'N/A'}`);
      console.log(`   - Amount: ${sub.amount || 0} ${sub.currency || 'INR'}`);
      console.log(`   `);
      console.log(`   📅 DATES:`);
      console.log(`   - Created: ${sub.created_at || 'N/A'}`);
      console.log(`   - Updated: ${sub.updated_at || 'N/A'}`);
      console.log(`   - Start: ${sub.subscription_start_date || 'N/A'}`);
      console.log(`   - End: ${sub.subscription_end_date || 'N/A'}`);
      console.log(`   `);
      console.log(`   🔑 RAZORPAY:`);
      console.log(`   - Payment ID: ${sub.razorpay_payment_id || 'N/A'}`);
      console.log(`   - Order ID: ${sub.razorpay_order_id || 'N/A'}`);
      console.log(`   `);
      console.log(`   📍 LOCATIONS:`);
      console.log(`   - Paid Location IDs: ${sub.paid_location_ids ? JSON.stringify(sub.paid_location_ids) : 'NONE'}`);
      console.log(`   ========================================\n`);
    });

    // Check for common issues
    console.log('🔍 CHECKING FOR COMMON ISSUES:\n');

    let issuesFound = false;

    subscriptions.forEach((sub) => {
      const issues = [];

      // Check if profile_count is missing or 0
      if (!sub.profile_count || sub.profile_count === 0) {
        issues.push(`❌ profile_count is ${sub.profile_count || 'NULL'} (should be ≥ 1)`);
      }

      // Check if status is active but subscription end date has passed
      if (sub.status === 'active' && sub.subscription_end_date) {
        const endDate = new Date(sub.subscription_end_date);
        if (endDate < new Date()) {
          issues.push(`⚠️ Subscription expired (end date: ${sub.subscription_end_date})`);
        }
      }

      // Check if paid but still marked as trial
      if (sub.status === 'trial' && sub.razorpay_payment_id) {
        issues.push(`❌ Status is 'trial' but payment exists (should be 'active')`);
      }

      // Check if profile_count doesn't match plan
      if (sub.plan_id === 'per_profile_yearly' && (!sub.profile_count || sub.profile_count < 1)) {
        issues.push(`❌ Per-profile plan but profile_count is ${sub.profile_count || 0}`);
      }

      if (issues.length > 0) {
        issuesFound = true;
        console.log(`⚠️ ISSUES FOUND for subscription ${sub.gbp_account_id || sub.user_id}:`);
        issues.forEach(issue => console.log(`   ${issue}`));
        console.log('');
      }
    });

    if (!issuesFound) {
      console.log('✅ No obvious issues found in subscription data!\n');
    }

    // Provide recommendations
    console.log('========================================');
    console.log('📋 RECOMMENDATIONS');
    console.log('========================================\n');

    console.log('If profile limit warning still shows after payment:\n');
    console.log('1. Check if profile_count is correctly set in database');
    console.log('   → Should match the number of profiles paid for (e.g., 2)');
    console.log('   → NOT accumulated (e.g., should be 2, not 1+2=3)\n');

    console.log('2. Check if frontend is refreshing subscription data');
    console.log('   → After payment, frontend should call /api/payment/subscription/status');
    console.log('   → SubscriptionContext should update with new data\n');

    console.log('3. Check browser localStorage');
    console.log('   → Clear cache and reload');
    console.log('   → Check DevTools → Application → Local Storage\n');

    console.log('4. Check if correct GBP Account ID is being used');
    console.log('   → Frontend and backend must use same gbpAccountId');
    console.log('   → Check browser console for mismatch warnings\n');

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Diagnostic error:', error);
  }
}

checkSubscriptions().then(() => {
  console.log('Diagnostic complete!');
  process.exit(0);
});
