import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('========================================');
console.log('🔍 FINDING YOUR ACCOUNT WITH PAYMENTS');
console.log('========================================\n');

async function findUserWithPayments() {
  try {
    // Get all subscriptions that have payment IDs (meaning they paid)
    const { data: paidSubscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .not('razorpay_payment_id', 'is', null)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error:', error);
      return;
    }

    console.log(`✅ Found ${paidSubscriptions.length} subscription(s) with payments\n`);

    paidSubscriptions.forEach((sub, index) => {
      console.log(`${index + 1}. Account with Payment:`);
      console.log(`   ========================================`);
      console.log(`   User ID: ${sub.user_id}`);
      console.log(`   GBP Account ID: ${sub.gbp_account_id}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Profile Count: ${sub.profile_count || 0} ⚠️`);
      console.log(`   Amount Paid: ${sub.amount || 0} ${sub.currency || 'INR'}`);
      console.log(`   Payment ID: ${sub.razorpay_payment_id}`);
      console.log(`   Order ID: ${sub.razorpay_order_id || 'N/A'}`);
      console.log(`   Plan ID: ${sub.plan_id || 'NOT SET ⚠️'}`);
      console.log(`   Plan Name: ${sub.plan_name || 'NOT SET ⚠️'}`);
      console.log(`   Updated: ${sub.updated_at}`);
      console.log(`   ========================================\n`);
    });

    // Check if user owns multiple Google Business Profile accounts
    console.log('🔍 Checking for users with multiple GBP accounts...\n');

    const { data: allSubs } = await supabase
      .from('subscriptions')
      .select('user_id, gbp_account_id, status, profile_count')
      .order('user_id');

    // Group by user_id
    const userAccounts = {};
    allSubs.forEach(sub => {
      if (!userAccounts[sub.user_id]) {
        userAccounts[sub.user_id] = [];
      }
      userAccounts[sub.user_id].push(sub);
    });

    // Find users with multiple accounts
    for (const [userId, accounts] of Object.entries(userAccounts)) {
      if (accounts.length > 1) {
        console.log(`👤 User ${userId} has ${accounts.length} GBP accounts:`);
        accounts.forEach((acc, idx) => {
          console.log(`   ${idx + 1}. ${acc.gbp_account_id} - Status: ${acc.status} - Profiles: ${acc.profile_count || 0}`);
        });
        console.log('');
      }
    }

    console.log('\n========================================');
    console.log('🎯 WHICH ACCOUNT IS YOURS?');
    console.log('========================================\n');
    console.log('Please tell me:');
    console.log('1. Your email address (used during payment)');
    console.log('2. OR your User ID (from Firebase)');
    console.log('3. OR your Google Business Profile Account ID');
    console.log('');
    console.log('I will then check how many profiles you actually paid for');
    console.log('and update the database to give you access to all of them!');
    console.log('\n========================================\n');

  } catch (error) {
    console.error('Error:', error);
  }
}

findUserWithPayments().then(() => {
  process.exit(0);
});
