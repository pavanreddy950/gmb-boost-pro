import './config.js';
import supabaseConfig from './config/supabase.js';

async function checkAllSubscriptions() {
  try {
    console.log('🔍 Checking ALL subscriptions in database...\n');

    const supabase = await supabaseConfig.ensureInitialized();

    // Get ALL subscriptions
    const { data: allSubs, error } = await supabase
      .from('subscriptions')
      .select('*')
      .order('created_at', { ascending: false});

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`✅ Total subscriptions: ${allSubs.length}\n`);

    if (allSubs.length > 0) {
      console.log('First 5 subscriptions:\n');
      allSubs.slice(0, 5).forEach((sub, index) => {
        console.log(`${index + 1}. Subscription ID: ${sub.id}`);
        console.log(`   Email: ${sub.email}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Plan ID: ${sub.plan_id}`);
        console.log(`   Amount: ${sub.amount} ${sub.currency}`);
        console.log(`   Paid At: ${sub.paid_at}`);
        console.log(`   Razorpay Payment ID: ${sub.razorpay_payment_id}`);
        console.log(`   Razorpay Order ID: ${sub.razorpay_order_id}`);
        console.log(`   Last Payment Date: ${sub.last_payment_date}`);
        console.log(`   Created At: ${sub.created_at}`);
        console.log('');
      });

      // Count by paid_at status
      const withPaidAt = allSubs.filter(s => s.paid_at !== null).length;
      const withoutPaidAt = allSubs.filter(s => s.paid_at === null).length;
      const withRazorpay = allSubs.filter(s => s.razorpay_payment_id !== null).length;
      const withAmount = allSubs.filter(s => s.amount !== null && s.amount > 0).length;

      console.log('📊 Statistics:');
      console.log(`   With paid_at: ${withPaidAt}`);
      console.log(`   Without paid_at: ${withoutPaidAt}`);
      console.log(`   With razorpay_payment_id: ${withRazorpay}`);
      console.log(`   With amount > 0: ${withAmount}`);
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAllSubscriptions();
