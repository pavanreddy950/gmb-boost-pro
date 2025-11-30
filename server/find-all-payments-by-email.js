import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

console.log('========================================');
console.log('🔍 FINDING ALL YOUR PAYMENTS');
console.log('========================================\n');

const EMAIL_TO_CHECK = 'rajaguptageneral@gmail.com';

async function findAllPayments() {
  try {
    // Get all payments (last 100)
    console.log(`📥 Fetching all payments...\n`);

    const allPayments = await razorpay.payments.all({ count: 100 });

    // Filter by email
    const yourPayments = allPayments.items.filter(p =>
      p.email && p.email.toLowerCase().includes('raja')
    );

    console.log(`✅ Found ${yourPayments.length} payment(s) related to your email\n`);

    let totalProfilesPaid = 0;
    const paymentDetails = [];

    for (const payment of yourPayments) {
      console.log('========================================');
      console.log(`💳 Payment ID: ${payment.id}`);
      console.log(`   Amount: ₹${payment.amount / 100}`);
      console.log(`   Status: ${payment.status}`);
      console.log(`   Email: ${payment.email}`);
      console.log(`   Date: ${new Date(payment.created_at * 1000).toLocaleString()}`);
      console.log(`   Order ID: ${payment.order_id || 'N/A'}`);

      if (payment.order_id) {
        try {
          const order = await razorpay.orders.fetch(payment.order_id);
          const profileCount = parseInt(order.notes?.profileCount || order.notes?.actualProfileCount || 0);

          console.log(`   📦 Profile Count: ${profileCount || 'NOT SET'}`);

          if (profileCount > 0) {
            totalProfilesPaid += profileCount;
            paymentDetails.push({
              paymentId: payment.id,
              amount: payment.amount / 100,
              profileCount: profileCount,
              date: new Date(payment.created_at * 1000),
              status: payment.status
            });
          }
        } catch (e) {
          console.log(`   ⚠️ Could not fetch order: ${e.message}`);
        }
      }
      console.log('');
    }

    console.log('\n========================================');
    console.log('📊 PAYMENT SUMMARY');
    console.log('========================================\n');
    console.log(`Total Payments: ${yourPayments.length}`);
    console.log(`Total Profiles Paid: ${totalProfilesPaid} profiles\n`);

    if (paymentDetails.length > 0) {
      console.log('Payment Breakdown:');
      paymentDetails.forEach((p, idx) => {
        console.log(`${idx + 1}. ${p.date.toLocaleDateString()} - ${p.profileCount} profile(s) - ₹${p.amount} - ${p.status}`);
      });
    } else {
      console.log('⚠️ No profile counts found in payment orders.');
      console.log('This means the orders were created before profile tracking was added.\n');
      console.log('Based on payment amounts:');
      yourPayments.forEach((p, idx) => {
        const estimatedProfiles = Math.round((p.amount / 100) / 99);
        console.log(`${idx + 1}. ₹${p.amount / 100} → ~${estimatedProfiles} profile(s)`);
      });
    }

    console.log('\n========================================');
    console.log('🎯 NEXT STEP');
    console.log('========================================\n');
    console.log('Please confirm:');
    console.log('1. How many profiles did you ACTUALLY pay for?');
    console.log('2. Do you remember the payment amount?');
    console.log('3. Which email did you use for payment?');
    console.log('');
    console.log('Once confirmed, I will update your database to:');
    console.log(`   - profile_count = [your actual number]`);
    console.log(`   - plan_id = "per_profile_yearly"`);
    console.log(`   - plan_name = "Per Profile Yearly - [X] Profiles"`);
    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

findAllPayments().then(() => {
  console.log('Search complete!');
  process.exit(0);
});
