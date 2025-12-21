import './config.js'; // Load environment variables first
import adminAnalyticsService from './services/adminAnalyticsService.js';

async function checkPayments() {
  try {
    console.log('🔍 Checking payment data using adminAnalyticsService...\n');

    // Use the same method the admin panel uses
    const payments = await adminAnalyticsService.loadPayments();

    console.log(`✅ Found ${payments.length} payments\n`);

    if (payments.length > 0) {
      console.log('First 10 payments:');
      payments.slice(0, 10).forEach((payment, index) => {
        console.log(`\n${index + 1}. Payment:`);
        console.log(`   Amount: ₹${payment.amount} ${payment.currency}`);
        console.log(`   Status: ${payment.status}`);
        console.log(`   Email: ${payment.email}`);
        console.log(`   Plan: ${payment.plan_id}`);
        console.log(`   Razorpay Payment ID: ${payment.razorpay_payment_id}`);
        console.log(`   Paid At: ${payment.paid_at}`);
      });

      // Test revenue analytics
      console.log('\n\n📊 Testing Revenue Analytics...');
      const revenue = await adminAnalyticsService.getRevenueAnalytics('30days');
      console.log(`Total Revenue (30 days): ₹${revenue.totalRevenue}`);
      console.log(`Total Payments: ${revenue.paymentCount}`);
      console.log(`Average Transaction: ₹${revenue.averageTransactionValue}`);
    } else {
      console.log('⚠️ No payments found in database');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPayments();
