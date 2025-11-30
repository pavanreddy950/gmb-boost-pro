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

const PAYMENT_ID = 'pay_RlzBqzMl8bQPwP';
const USER_ID = 'eWw8jjayQcSKN8uk9GLyNg49lMn2';
const GBP_ACCOUNT_ID = '104728397456701856554';

console.log('========================================');
console.log('💳 CHECKING YOUR PAYMENT DETAILS');
console.log('========================================\n');

async function checkPaymentDetails() {
  try {
    // Get payment details from Razorpay
    console.log(`📥 Fetching payment: ${PAYMENT_ID}\n`);

    const payment = await razorpay.payments.fetch(PAYMENT_ID);

    console.log('Payment Details:');
    console.log(`   Amount: ₹${payment.amount / 100}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Email: ${payment.email}`);
    console.log(`   Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);
    console.log(`   Order ID: ${payment.order_id || 'N/A'}`);
    console.log('');

    // Get order details if available
    if (payment.order_id) {
      console.log(`📦 Fetching order: ${payment.order_id}\n`);

      const order = await razorpay.orders.fetch(payment.order_id);

      console.log('Order Details:');
      console.log(`   Amount: ₹${order.amount / 100}`);
      console.log(`   Status: ${order.status}`);
      console.log('');
      console.log('   📋 Order Notes (Profile Info):');
      console.log(`   - Profile Count: ${order.notes?.profileCount || order.notes?.actualProfileCount || 'NOT SET ⚠️'}`);
      console.log(`   - Plan ID: ${order.notes?.planId || 'NOT SET ⚠️'}`);
      console.log(`   - Plan Name: ${order.notes?.planName || 'NOT SET ⚠️'}`);
      console.log(`   - User ID: ${order.notes?.userId || order.notes?.firebaseUid || 'N/A'}`);
      console.log(`   - GBP Account ID: ${order.notes?.gbpAccountId || 'N/A'}`);
      console.log('');

      const profileCount = parseInt(order.notes?.profileCount || order.notes?.actualProfileCount || 0);

      if (profileCount > 0) {
        console.log(`✅ YOU PAID FOR: ${profileCount} PROFILE(S)\n`);

        // Check what's in database
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('gbp_account_id', GBP_ACCOUNT_ID)
          .single();

        if (subscription) {
          console.log('❌ DATABASE CURRENTLY SHOWS:');
          console.log(`   - Profile Count: ${subscription.profile_count || 0}`);
          console.log(`   - Plan ID: ${subscription.plan_id || 'NULL'}`);
          console.log(`   - Status: ${subscription.status}`);
          console.log('');

          const difference = profileCount - (subscription.profile_count || 0);
          if (difference > 0) {
            console.log(`🚨 MISSING ${difference} PROFILE(S) IN DATABASE!\n`);
            console.log('========================================');
            console.log('🔧 FIX NEEDED');
            console.log('========================================\n');
            console.log('I need to update your subscription in Supabase:');
            console.log(`   - Set profile_count = ${profileCount}`);
            console.log(`   - Set plan_id = "per_profile_yearly"`);
            console.log(`   - Set plan_name = "Per Profile Yearly - ${profileCount} Profiles"`);
            console.log('');
            console.log('Do you want me to fix this now? (I will create a fix script)');
            console.log('========================================\n');
          } else {
            console.log('✅ Database is correct!\n');
          }
        }
      } else {
        console.log('⚠️ No profile count found in order notes.');
        console.log('This might mean the order was created before we added profile tracking.\n');
        console.log('Based on the amount paid, how many profiles did you purchase?');
        console.log('   - 1 profile = ₹99');
        console.log('   - 2 profiles = ₹198');
        console.log('   - 10 profiles = ₹990');
        console.log('');
        console.log(`Your payment: ₹${order.amount / 100}`);
        console.log(`Estimated profiles: ${Math.round((order.amount / 100) / 99)} profiles\n`);
      }
    } else {
      console.log('⚠️ No order ID found for this payment.\n');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkPaymentDetails().then(() => {
  console.log('Check complete!');
  process.exit(0);
});
