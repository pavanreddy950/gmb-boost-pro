import { createClient } from '@supabase/supabase-js';
import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log('========================================');
console.log('🔧 ADMIN: FIND AND FIX ALL AFFECTED USERS');
console.log('========================================\n');

async function findAndFixAllAffectedUsers() {
  try {
    // Step 1: Find all subscriptions with issues
    console.log('📊 Step 1: Finding affected subscriptions...\n');

    const { data: subscriptions, error } = await supabase
      .from('subscriptions')
      .select('*')
      .or('profile_count.is.null,profile_count.eq.0,plan_id.is.null')
      .not('razorpay_payment_id', 'is', null) // Only subscriptions with payments
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching subscriptions:', error);
      return;
    }

    console.log(`✅ Found ${subscriptions.length} subscription(s) with potential issues\n`);

    if (subscriptions.length === 0) {
      console.log('🎉 No affected subscriptions found! All good!');
      return;
    }

    // Step 2: Analyze each subscription
    console.log('========================================');
    console.log('📋 ANALYZING EACH SUBSCRIPTION');
    console.log('========================================\n');

    const fixes = [];

    for (const sub of subscriptions) {
      console.log(`\n--- Subscription ${sub.id} ---`);
      console.log(`User ID: ${sub.user_id}`);
      console.log(`GBP Account: ${sub.gbp_account_id}`);
      console.log(`Current Profile Count: ${sub.profile_count || 0}`);
      console.log(`Current Plan ID: ${sub.plan_id || 'NULL'}`);
      console.log(`Payment ID: ${sub.razorpay_payment_id || 'NONE'}`);
      console.log(`Amount Paid: ${sub.amount || 0} ${sub.currency || 'INR'}`);

      let suggestedProfileCount = sub.profile_count || 1;
      let source = 'default';

      // Try to get profile count from Razorpay payment
      if (sub.razorpay_payment_id) {
        try {
          const payment = await razorpay.payments.fetch(sub.razorpay_payment_id);

          // Check if it's a subscription payment
          if (payment.subscription_id) {
            const subscription = await razorpay.subscriptions.fetch(payment.subscription_id);
            const profileCount = parseInt(
              subscription.notes?.actualProfileCount ||
              subscription.notes?.profileCount ||
              subscription.quantity ||
              0
            );

            if (profileCount > 0) {
              suggestedProfileCount = profileCount;
              source = 'razorpay_subscription';
              console.log(`   ✅ Found in Razorpay Subscription: ${profileCount} profile(s)`);
            }
          }
          // Check if it's an order payment
          else if (payment.order_id) {
            const order = await razorpay.orders.fetch(payment.order_id);
            const profileCount = parseInt(
              order.notes?.actualProfileCount ||
              order.notes?.profileCount ||
              0
            );

            if (profileCount > 0) {
              suggestedProfileCount = profileCount;
              source = 'razorpay_order';
              console.log(`   ✅ Found in Razorpay Order: ${profileCount} profile(s)`);
            } else {
              console.log(`   ⚠️ Order notes are empty`);

              // Estimate from amount
              if (sub.amount && sub.amount > 0) {
                const amountInRupees = sub.currency === 'INR' ? sub.amount : sub.amount;
                const estimatedProfiles = Math.max(1, Math.round(amountInRupees / 99));
                suggestedProfileCount = estimatedProfiles;
                source = 'estimated_from_amount';
                console.log(`   💡 Estimated from amount: ${estimatedProfiles} profile(s)`);
              }
            }
          }
        } catch (razorpayError) {
          console.log(`   ❌ Error fetching from Razorpay: ${razorpayError.message}`);
        }
      }

      // Determine if fix is needed
      const needsFix = !sub.profile_count || sub.profile_count === 0 || !sub.plan_id;

      if (needsFix) {
        fixes.push({
          subscription: sub,
          suggestedProfileCount,
          source,
          needsFix: true
        });
        console.log(`   ⚠️ NEEDS FIX: Will set profile_count to ${suggestedProfileCount} (source: ${source})`);
      } else {
        console.log(`   ✅ OK: No fix needed`);
      }
    }

    // Step 3: Summarize and ask for confirmation
    console.log('\n\n========================================');
    console.log('📊 SUMMARY');
    console.log('========================================\n');
    console.log(`Total subscriptions analyzed: ${subscriptions.length}`);
    console.log(`Subscriptions needing fixes: ${fixes.length}`);
    console.log('');

    if (fixes.length === 0) {
      console.log('🎉 All subscriptions are correct! No fixes needed.');
      return;
    }

    console.log('PROPOSED FIXES:\n');
    fixes.forEach((fix, index) => {
      console.log(`${index + 1}. GBP ${fix.subscription.gbp_account_id}`);
      console.log(`   User: ${fix.subscription.user_id}`);
      console.log(`   Current: profile_count=${fix.subscription.profile_count || 0}, plan_id=${fix.subscription.plan_id || 'NULL'}`);
      console.log(`   Fix to: profile_count=${fix.suggestedProfileCount}, plan_id=per_profile_yearly`);
      console.log(`   Source: ${fix.source}`);
      console.log('');
    });

    console.log('========================================');
    console.log('⚠️ MANUAL CONFIRMATION REQUIRED');
    console.log('========================================\n');
    console.log('This script will NOT automatically apply fixes.');
    console.log('To apply fixes, create individual fix scripts or update database manually.');
    console.log('');
    console.log('Example fix for each:');
    fixes.forEach((fix, index) => {
      if (index < 3) { // Show first 3 examples
        console.log(`\nFix #${index + 1}:`);
        console.log(`UPDATE subscriptions SET`);
        console.log(`  profile_count = ${fix.suggestedProfileCount},`);
        console.log(`  plan_id = 'per_profile_yearly'`);
        console.log(`WHERE gbp_account_id = '${fix.subscription.gbp_account_id}';`);
      }
    });

    if (fixes.length > 3) {
      console.log(`\n... and ${fixes.length - 3} more fixes needed.`);
    }

    console.log('\n========================================\n');

    // Export fixes to JSON for review
    const fs = await import('fs');
    const fixesJson = JSON.stringify(fixes.map(f => ({
      gbpAccountId: f.subscription.gbp_account_id,
      userId: f.subscription.user_id,
      currentProfileCount: f.subscription.profile_count || 0,
      suggestedProfileCount: f.suggestedProfileCount,
      source: f.source,
      email: f.subscription.email
    })), null, 2);

    fs.writeFileSync('affected-users-fixes.json', fixesJson);
    console.log('📄 Fixes exported to: affected-users-fixes.json');
    console.log('Review this file and apply fixes manually or create automated fix script.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAndFixAllAffectedUsers().then(() => {
  console.log('Analysis complete!');
  process.exit(0);
});
