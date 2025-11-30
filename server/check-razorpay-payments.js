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
console.log('💰 RAZORPAY PAYMENT HISTORY CHECK');
console.log('========================================\n');

async function checkPayments() {
  try {
    // Get all payments from Razorpay (last 100)
    console.log('📥 Fetching payment history from Razorpay...\n');

    const payments = await razorpay.payments.all({
      count: 100
    });

    console.log(`✅ Found ${payments.items.length} payment(s) in Razorpay\n`);

    // Filter successful payments only
    const successfulPayments = payments.items.filter(p => p.status === 'captured');
    console.log(`✅ ${successfulPayments.items.length} successful payment(s)\n`);

    // Group payments by user/account
    const paymentsByUser = {};

    for (const payment of successfulPayments) {
      console.log('========================================');
      console.log(`💳 Payment ID: ${payment.id}`);
      console.log(`   Amount: ${payment.amount / 100} ${payment.currency}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);
      console.log(`   Email: ${payment.email || 'N/A'}`);
      console.log(`   Order ID: ${payment.order_id || 'N/A'}`);

      // Get order details to see notes
      if (payment.order_id) {
        try {
          const order = await razorpay.orders.fetch(payment.order_id);
          console.log(`   \n   📦 ORDER DETAILS:`);
          console.log(`   - Profile Count: ${order.notes?.profileCount || order.notes?.actualProfileCount || 'NOT SET ⚠️'}`);
          console.log(`   - User ID: ${order.notes?.userId || order.notes?.firebaseUid || 'N/A'}`);
          console.log(`   - GBP Account ID: ${order.notes?.gbpAccountId || 'N/A'}`);
          console.log(`   - Location ID: ${order.notes?.locationId || 'N/A'}`);
          console.log(`   - Plan: ${order.notes?.planName || order.notes?.planId || 'N/A'}`);

          // Track by user
          const userId = order.notes?.userId || order.notes?.firebaseUid || payment.email;
          if (userId) {
            if (!paymentsByUser[userId]) {
              paymentsByUser[userId] = {
                payments: [],
                totalProfilesPaid: 0,
                totalAmount: 0
              };
            }

            const profileCount = parseInt(order.notes?.profileCount || order.notes?.actualProfileCount || 1);
            paymentsByUser[userId].payments.push({
              paymentId: payment.id,
              amount: payment.amount / 100,
              profileCount: profileCount,
              date: new Date(payment.created_at * 1000),
              gbpAccountId: order.notes?.gbpAccountId
            });
            paymentsByUser[userId].totalProfilesPaid += profileCount;
            paymentsByUser[userId].totalAmount += payment.amount / 100;
          }

        } catch (orderError) {
          console.log(`   ⚠️ Could not fetch order details: ${orderError.message}`);
        }
      }
      console.log('');
    }

    // Summary by user
    console.log('\n========================================');
    console.log('📊 PAYMENT SUMMARY BY USER');
    console.log('========================================\n');

    for (const [userId, data] of Object.entries(paymentsByUser)) {
      console.log(`👤 User: ${userId}`);
      console.log(`   Total Payments: ${data.payments.length}`);
      console.log(`   Total Profiles Paid: ${data.totalProfilesPaid} profiles ⚠️`);
      console.log(`   Total Amount Paid: ${data.totalAmount} INR`);
      console.log(`   \n   Payment History:`);

      data.payments.forEach((p, idx) => {
        console.log(`   ${idx + 1}. ${p.date.toLocaleDateString()} - ${p.profileCount} profile(s) - ${p.amount} INR - ${p.paymentId}`);
      });

      // Check what's in database
      if (data.payments[0]?.gbpAccountId) {
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('*')
          .eq('gbp_account_id', data.payments[0].gbpAccountId)
          .single();

        if (subscription) {
          console.log(`\n   📊 DATABASE STATUS:`);
          console.log(`   - Profile Count in DB: ${subscription.profile_count || 0} ⚠️`);
          console.log(`   - Should be: ${data.totalProfilesPaid} profiles`);
          console.log(`   - Difference: ${data.totalProfilesPaid - (subscription.profile_count || 0)} profiles MISSING! ❌`);
        }
      }

      console.log('\n');
    }

    // Recommendations
    console.log('========================================');
    console.log('🔧 WHAT TO FIX');
    console.log('========================================\n');

    for (const [userId, data] of Object.entries(paymentsByUser)) {
      if (data.totalProfilesPaid > 1) {
        console.log(`❌ ISSUE FOUND for user ${userId}:`);
        console.log(`   - Paid for: ${data.totalProfilesPaid} profiles`);
        console.log(`   - Database shows: 1 profile (or less)`);
        console.log(`   - Action needed: Update profile_count to ${data.totalProfilesPaid}\n`);
      }
    }

    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error checking payments:', error);
    console.error(error.stack);
  }
}

checkPayments().then(() => {
  console.log('Payment check complete!');
  process.exit(0);
});
