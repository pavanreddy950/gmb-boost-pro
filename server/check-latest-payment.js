import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

const PAYMENT_ID = 'pay_Rm3Lq24yuvCC7z'; // Latest payment from database

console.log('========================================');
console.log('💳 CHECKING LATEST PAYMENT DETAILS');
console.log('========================================\n');
console.log(`Payment ID: ${PAYMENT_ID}\n`);

async function checkLatestPayment() {
  try {
    // Get payment details
    const payment = await razorpay.payments.fetch(PAYMENT_ID);

    console.log('📥 PAYMENT DETAILS:\n');
    console.log(`Amount: ₹${payment.amount / 100}`);
    console.log(`Status: ${payment.status}`);
    console.log(`Email: ${payment.email || 'N/A'}`);
    console.log(`Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);
    console.log(`Order ID: ${payment.order_id || 'NONE'}`);
    console.log('');

    // Get order details if available
    if (payment.order_id) {
      console.log(`📦 FETCHING ORDER: ${payment.order_id}\n`);

      const order = await razorpay.orders.fetch(payment.order_id);

      console.log('ORDER DETAILS:\n');
      console.log(`Amount: ₹${order.amount / 100}`);
      console.log(`Status: ${order.status}`);
      console.log('');
      console.log('📋 ORDER NOTES:');
      console.log(JSON.stringify(order.notes, null, 2));
      console.log('');

      // Extract profile count
      const profileCount = parseInt(
        order.notes?.profileCount ||
        order.notes?.actualProfileCount ||
        order.notes?.quantity ||
        0
      );

      const planId = order.notes?.planId || 'per_profile_yearly';
      const userId = order.notes?.userId || order.notes?.firebaseUid;
      const gbpAccountId = order.notes?.gbpAccountId;

      console.log('========================================');
      console.log('📊 EXTRACTED DATA:');
      console.log('========================================\n');
      console.log(`Profile Count: ${profileCount || 'NOT FOUND ⚠️'}`);
      console.log(`Plan ID: ${planId}`);
      console.log(`User ID: ${userId || 'N/A'}`);
      console.log(`GBP Account: ${gbpAccountId || 'N/A'}`);
      console.log('');

      if (profileCount > 0) {
        console.log(`✅ USER PAID FOR: ${profileCount} PROFILE(S)\n`);
        console.log('========================================');
        console.log('🔧 DATABASE NEEDS UPDATE:');
        console.log('========================================\n');
        console.log('Current database values (GBP 104728397456701856554):');
        console.log(`   - Profile Count: 1`);
        console.log(`   - Plan ID: NULL`);
        console.log('');
        console.log('Should be updated to:');
        console.log(`   - Profile Count: ${profileCount}`);
        console.log(`   - Plan ID: "${planId}"`);
        console.log(`   - Plan Name: "Per Profile Yearly - ${profileCount} Profiles"`);
        console.log('');
      } else {
        console.log('❌ NO PROFILE COUNT IN ORDER NOTES\n');
        console.log('This means the RAJATEST coupon bug is STILL happening!');
        console.log('The payment flow is not saving profileCount to order notes.\n');

        // Estimate from amount
        const estimatedProfiles = Math.round((order.amount / 100) / 99);
        console.log('💡 ESTIMATION:');
        console.log(`   Payment Amount: ₹${order.amount / 100}`);
        console.log(`   Estimated Profiles: ${estimatedProfiles} (at ₹99/profile)\n`);

        console.log('User said they selected "mostly above 10" profiles.');
        console.log('We need to ask the user to confirm the exact number.\n');
      }

    } else {
      console.log('❌ NO ORDER ID FOUND FOR THIS PAYMENT\n');
      console.log('The payment was not linked to an order.');
      console.log('Cannot extract profile count without order notes.\n');
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  }
}

checkLatestPayment().then(() => {
  console.log('Check complete!');
  process.exit(0);
});
