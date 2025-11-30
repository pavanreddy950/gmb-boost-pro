import Razorpay from 'razorpay';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('========================================');
console.log('🔍 EXTRACTING PROFILE COUNTS FROM ORDERS');
console.log('========================================\n');

const YOUR_PAYMENT_IDS = [
  'pay_RlzBqzMl8bQPwP', // ₹1 - Nov 30
  'pay_RlzAb8DGqaJN90', // ₹1 - Nov 30
  'pay_RkQhgirfsILxyE', // ₹353 - Nov 26
  'pay_RigemGDnxQFrAV', // ₹354 - Nov 22
  'pay_Rc0wKE4mfH7xR9'  // ₹1 - Nov 5
];

async function extractProfileCounts() {
  try {
    let totalProfilesPaidFor = 0;
    const profileBreakdown = [];

    for (const paymentId of YOUR_PAYMENT_IDS) {
      console.log(`📥 Checking payment: ${paymentId}`);

      try {
        const payment = await razorpay.payments.fetch(paymentId);

        if (payment.status !== 'captured') {
          console.log(`   ❌ Status: ${payment.status} - SKIPPING\n`);
          continue;
        }

        console.log(`   ✅ Status: ${payment.status}`);
        console.log(`   Amount: ₹${payment.amount / 100}`);
        console.log(`   Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);

        if (payment.order_id) {
          const order = await razorpay.orders.fetch(payment.order_id);

          console.log(`   \n   📦 ORDER NOTES:`);
          console.log(`   Full notes:`, JSON.stringify(order.notes, null, 2));

          // Try different ways the profile count might be stored
          const profileCount = parseInt(
            order.notes?.profileCount ||
            order.notes?.actualProfileCount ||
            order.notes?.quantity ||
            0
          );

          const planId = order.notes?.planId || 'per_profile_yearly';
          const userId = order.notes?.userId || order.notes?.firebaseUid;
          const gbpAccountId = order.notes?.gbpAccountId;

          console.log(`   \n   📊 EXTRACTED DATA:`);
          console.log(`   - Profile Count: ${profileCount || 'NOT FOUND ⚠️'}`);
          console.log(`   - Plan ID: ${planId}`);
          console.log(`   - User ID: ${userId || 'N/A'}`);
          console.log(`   - GBP Account: ${gbpAccountId || 'N/A'}`);

          if (profileCount > 0) {
            totalProfilesPaidFor += profileCount;
            profileBreakdown.push({
              paymentId,
              date: new Date(payment.created_at * 1000),
              profileCount,
              amount: payment.amount / 100
            });
            console.log(`   ✅ Added ${profileCount} profile(s) to total`);
          } else {
            console.log(`   ⚠️ No profile count in order notes - checking original amount...`);

            // Check if original USD amount is in notes
            const originalUsd = parseFloat(order.notes?.originalUsdAmount || 0);
            if (originalUsd > 0) {
              const estimatedProfiles = Math.round(originalUsd / 99); // $99 per profile
              console.log(`   💡 Original USD: $${originalUsd} → Estimated ${estimatedProfiles} profile(s)`);

              if (estimatedProfiles > 0) {
                totalProfilesPaidFor += estimatedProfiles;
                profileBreakdown.push({
                  paymentId,
                  date: new Date(payment.created_at * 1000),
                  profileCount: estimatedProfiles,
                  amount: payment.amount / 100,
                  estimated: true
                });
                console.log(`   ✅ Added ${estimatedProfiles} estimated profile(s) to total`);
              }
            }
          }
        }

        console.log('');
      } catch (err) {
        console.log(`   ❌ Error: ${err.message}\n`);
      }
    }

    console.log('========================================');
    console.log('📊 TOTAL PROFILE COUNT');
    console.log('========================================\n');

    console.log(`✅ TOTAL PROFILES PAID FOR: ${totalProfilesPaidFor}\n`);

    if (profileBreakdown.length > 0) {
      console.log('Breakdown by payment:');
      profileBreakdown.forEach((p, idx) => {
        const estimated = p.estimated ? ' (estimated)' : '';
        console.log(`${idx + 1}. ${p.date.toLocaleDateString()} - ${p.profileCount} profile(s)${estimated} - ₹${p.amount}`);
      });
    }

    console.log('\n========================================');
    console.log('🔧 DATABASE UPDATE NEEDED');
    console.log('========================================\n');

    const { data: currentSub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('gbp_account_id', '104728397456701856554')
      .single();

    if (currentSub) {
      console.log('Current database values:');
      console.log(`   - Profile Count: ${currentSub.profile_count || 0}`);
      console.log(`   - Plan ID: ${currentSub.plan_id || 'NULL'}`);
      console.log('');
      console.log('Should be updated to:');
      console.log(`   - Profile Count: ${totalProfilesPaidFor}`);
      console.log(`   - Plan ID: "per_profile_yearly"`);
      console.log(`   - Plan Name: "Per Profile Yearly - ${totalProfilesPaidFor} Profiles"`);
      console.log('');

      const difference = totalProfilesPaidFor - (currentSub.profile_count || 0);
      if (difference > 0) {
        console.log(`🚨 YOU ARE MISSING ${difference} PROFILE(S) IN THE DATABASE!`);
        console.log('');
        console.log('Do you want me to create a script to fix this? (Y/N)');
      } else if (difference === 0) {
        console.log('✅ Database is already correct!');
      } else {
        console.log('⚠️ Database has MORE profiles than payments show - manual review needed');
      }
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

extractProfileCounts().then(() => {
  console.log('Analysis complete!');
  process.exit(0);
});
