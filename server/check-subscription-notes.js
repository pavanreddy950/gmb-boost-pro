import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PAYMENT_ID = 'pay_Rm3Lq24yuvCC7z'; // Latest payment from database

console.log('========================================');
console.log('🔍 CHECKING SUBSCRIPTION NOTES');
console.log('========================================\n');

async function checkSubscriptionNotes() {
  try {
    // Get payment details
    console.log(`📥 Fetching payment: ${PAYMENT_ID}\n`);
    const payment = await razorpay.payments.fetch(PAYMENT_ID);

    console.log('PAYMENT DETAILS:');
    console.log(`   Amount: ₹${payment.amount / 100}`);
    console.log(`   Status: ${payment.status}`);
    console.log(`   Email: ${payment.email || 'N/A'}`);
    console.log(`   Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);
    console.log(`   Order ID: ${payment.order_id || 'NONE'}`);
    console.log(`   Subscription ID: ${payment.subscription_id || 'NONE'}`);
    console.log('');

    // Check if this is a subscription payment
    if (payment.subscription_id) {
      console.log(`📦 FETCHING SUBSCRIPTION: ${payment.subscription_id}\n`);

      const subscription = await razorpay.subscriptions.fetch(payment.subscription_id);

      console.log('SUBSCRIPTION DETAILS:\n');
      console.log(`Plan ID: ${subscription.plan_id}`);
      console.log(`Status: ${subscription.status}`);
      console.log(`Quantity: ${subscription.quantity}`);
      console.log(`Created: ${new Date(subscription.created_at * 1000).toLocaleString()}`);
      console.log('');
      console.log('📋 SUBSCRIPTION NOTES:');
      console.log(JSON.stringify(subscription.notes, null, 2));
      console.log('');

      // Extract profile count from subscription notes
      const profileCount = parseInt(
        subscription.notes?.actualProfileCount ||
        subscription.notes?.profileCount ||
        subscription.quantity ||
        0
      );

      const planId = subscription.notes?.planId;
      const planName = subscription.notes?.planName;
      const userId = subscription.notes?.userId;
      const gbpAccountId = subscription.notes?.gbpAccountId;

      console.log('========================================');
      console.log('📊 EXTRACTED DATA FROM SUBSCRIPTION:');
      console.log('========================================\n');
      console.log(`Profile Count: ${profileCount || 'NOT FOUND ⚠️'}`);
      console.log(`Plan ID: ${planId || 'NOT FOUND ⚠️'}`);
      console.log(`Plan Name: ${planName || 'NOT FOUND ⚠️'}`);
      console.log(`User ID: ${userId || 'N/A'}`);
      console.log(`GBP Account: ${gbpAccountId || 'N/A'}`);
      console.log(`Quantity: ${subscription.quantity}`);
      console.log('');

      if (profileCount > 0) {
        console.log(`✅ USER PAID FOR: ${profileCount} PROFILE(S)\n`);
        console.log('========================================');
        console.log('🔧 DATABASE NEEDS UPDATE:');
        console.log('========================================\n');
        console.log('The database should have:');
        console.log(`   - Profile Count: ${profileCount}`);
        console.log(`   - Plan ID: "${planId || 'per_profile_yearly'}"`);
        console.log(`   - Plan Name: "${planName || `Per Profile Yearly - ${profileCount} Profiles`}"`);
        console.log('');
      } else {
        console.log('❌ NO PROFILE COUNT FOUND IN SUBSCRIPTION NOTES\n');
        console.log('Falling back to subscription quantity...');
        console.log(`Subscription Quantity: ${subscription.quantity}`);
        console.log('');
      }

    } else if (payment.order_id) {
      console.log(`📦 FETCHING ORDER: ${payment.order_id}\n`);

      const order = await razorpay.orders.fetch(payment.order_id);

      console.log('ORDER DETAILS:\n');
      console.log(`Amount: ₹${order.amount / 100}`);
      console.log(`Status: ${order.status}`);
      console.log('');
      console.log('📋 ORDER NOTES:');
      console.log(JSON.stringify(order.notes, null, 2));
      console.log('');

      const profileCount = parseInt(
        order.notes?.profileCount ||
        order.notes?.actualProfileCount ||
        0
      );

      if (profileCount > 0) {
        console.log(`✅ USER PAID FOR: ${profileCount} PROFILE(S)\n`);
      } else {
        console.log('❌ NO PROFILE COUNT IN ORDER NOTES\n');
      }
    } else {
      console.log('⚠️ NO SUBSCRIPTION ID OR ORDER ID FOUND\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkSubscriptionNotes().then(() => {
  console.log('Check complete!');
  process.exit(0);
});
