import './config.js';
import supabaseConfig from './config/supabase.js';

async function checkRazorpaySubscriptions() {
  try {
    console.log('🔍 Checking subscriptions with Razorpay data...\n');

    const supabase = await supabaseConfig.ensureInitialized();

    // Get subscriptions that have razorpay payment data
    const { data: subs, error } = await supabase
      .from('subscriptions')
      .select('*')
      .not('razorpay_payment_id', 'is', null)
      .order('created_at', { ascending: false});

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log(`✅ Found ${subs.length} subscriptions with Razorpay payment ID\n`);

    subs.forEach((sub, index) => {
      console.log(`${index + 1}. Subscription:`);
      console.log(`   ID: ${sub.id}`);
      console.log(`   Email: ${sub.email}`);
      console.log(`   Status: ${sub.status}`);
      console.log(`   Plan ID: ${sub.plan_id}`);
      console.log(`   Profile Count: ${sub.profile_count}`);
      console.log(`   Amount: ${sub.amount} ${sub.currency}`);
      console.log(`   Razorpay Payment ID: ${sub.razorpay_payment_id}`);
      console.log(`   Razorpay Order ID: ${sub.razorpay_order_id}`);
      console.log(`   Paid At: ${sub.paid_at}`);
      console.log(`   Last Payment Date: ${sub.last_payment_date}`);
      console.log(`   Created At: ${sub.created_at}`);
      console.log('');
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkRazorpaySubscriptions();
