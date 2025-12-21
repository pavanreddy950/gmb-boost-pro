import './config.js';
import Razorpay from 'razorpay';

async function fetchPaymentAmounts() {
  try {
    console.log('🔍 Fetching actual payment amounts from Razorpay...\n');

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET
    });

    const paymentIds = [
      'pay_RuFF1pDIyLMOmH', // hello.lobaiseo@gmail.com
      'pay_RtLTQrCQmZUY5t'  // rajaguptageneral@gmail.com
    ];

    for (const paymentId of paymentIds) {
      try {
        const payment = await razorpay.payments.fetch(paymentId);
        console.log(`Payment ID: ${paymentId}`);
        console.log(`  Amount: ₹${payment.amount / 100} ${payment.currency}`);
        console.log(`  Status: ${payment.status}`);
        console.log(`  Email: ${payment.email}`);
        console.log(`  Created At: ${new Date(payment.created_at * 1000).toISOString()}`);
        console.log(`  Method: ${payment.method}`);
        console.log('');
      } catch (err) {
        console.error(`Failed to fetch ${paymentId}:`, err.error || err.message);
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fetchPaymentAmounts();
