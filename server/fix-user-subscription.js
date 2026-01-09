/**
 * Fix subscription for hello.lobaiseo@gmail.com
 * Set profile_count to 11 and update subscription status
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const email = process.argv[2] || 'hello.lobaiseo@gmail.com';
const profileCount = parseInt(process.argv[3]) || 11;

async function fixUserSubscription() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log(`🔧 Fixing subscription for: ${email}`);
  console.log(`📊 Setting profile_count to: ${profileCount}`);
  console.log('==========================================\n');

  // 1. Get current user data
  console.log('1️⃣ CURRENT USER DATA:');
  console.log('-'.repeat(40));

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('gmail_id', email)
    .single();

  if (userError) {
    console.error('❌ Error finding user:', userError.message);
    process.exit(1);
  }

  console.log('Current values:');
  console.log(`   subscription_status: ${user.subscription_status}`);
  console.log(`   profile_count: ${user.profile_count}`);
  console.log(`   trial_start_date: ${user.trial_start_date}`);
  console.log(`   trial_end_date: ${user.trial_end_date}`);
  console.log(`   subscription_start_date: ${user.subscription_start_date}`);
  console.log(`   subscription_end_date: ${user.subscription_end_date}`);
  console.log(`   razorpay_payment_id: ${user.razorpay_payment_id}`);
  console.log(`   amount_paid: ${user.amount_paid}`);

  // 2. Update user subscription
  console.log('\n2️⃣ UPDATING USER:');
  console.log('-'.repeat(40));

  const now = new Date();
  const oneYearLater = new Date();
  oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

  const { data: updated, error: updateError } = await supabase
    .from('users')
    .update({
      subscription_status: 'active',
      profile_count: profileCount,
      subscription_start_date: now.toISOString(),
      subscription_end_date: oneYearLater.toISOString(),
      updated_at: now.toISOString()
    })
    .eq('gmail_id', email)
    .select()
    .single();

  if (updateError) {
    console.error('❌ Error updating user:', updateError.message);
    process.exit(1);
  }

  console.log('✅ User updated successfully!');
  console.log('\nNew values:');
  console.log(`   subscription_status: ${updated.subscription_status}`);
  console.log(`   profile_count: ${updated.profile_count}`);
  console.log(`   subscription_start_date: ${updated.subscription_start_date}`);
  console.log(`   subscription_end_date: ${updated.subscription_end_date}`);

  console.log('\n==========================================');
  console.log('✅ Fix complete! User should now have access to 11 profiles.');
  console.log('==========================================\n');
}

fixUserSubscription().catch(console.error);
