/**
 * Reset user subscription to trial for testing
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const email = process.argv[2] || 'hello.lobaiseo@gmail.com';

async function resetToTrial() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log(`🔄 Resetting subscription for: ${email}`);
  console.log('==========================================\n');

  // Calculate trial dates (15 days from now)
  const now = new Date();
  const trialEnd = new Date();
  trialEnd.setDate(trialEnd.getDate() + 15);

  // Reset to trial
  const { data, error } = await supabase
    .from('users')
    .update({
      subscription_status: 'trial',
      trial_start_date: now.toISOString(),
      trial_end_date: trialEnd.toISOString(),
      subscription_start_date: null,
      subscription_end_date: null,
      profile_count: 0,
      razorpay_order_id: null,
      razorpay_payment_id: null,
      razorpay_subscription_id: null,
      amount_paid: 0,
      updated_at: now.toISOString()
    })
    .eq('gmail_id', email)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }

  console.log('✅ User reset to trial successfully!\n');
  console.log('New values:');
  console.log(`   subscription_status: ${data.subscription_status}`);
  console.log(`   trial_start_date: ${data.trial_start_date}`);
  console.log(`   trial_end_date: ${data.trial_end_date}`);
  console.log(`   subscription_start_date: ${data.subscription_start_date}`);
  console.log(`   subscription_end_date: ${data.subscription_end_date}`);
  console.log(`   profile_count: ${data.profile_count}`);
  console.log(`   razorpay_payment_id: ${data.razorpay_payment_id}`);
  console.log(`   amount_paid: ${data.amount_paid}`);

  console.log('\n==========================================');
  console.log('✅ Ready for payment testing!');
  console.log('==========================================\n');
}

resetToTrial().catch(console.error);
