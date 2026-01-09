/**
 * Check subscription status for a specific user
 * Usage: node check-user-subscription.js hello.lobaiseo@gmail.com
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const email = process.argv[2] || 'hello.lobaiseo@gmail.com';

async function checkUserSubscription() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found in environment variables');
    console.log('Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log(`📧 Checking subscription for: ${email}`);
  console.log('==========================================\n');

  // 1. Check subscriptions table
  console.log('1️⃣ SUBSCRIPTIONS TABLE:');
  console.log('-'.repeat(40));

  const { data: subscriptions, error: subError } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('email', email);

  if (subError) {
    console.error('❌ Error querying subscriptions:', subError.message);
  } else if (!subscriptions || subscriptions.length === 0) {
    console.log('⚠️ No subscriptions found for this email');
  } else {
    console.log(`✅ Found ${subscriptions.length} subscription(s):\n`);
    subscriptions.forEach((sub, i) => {
      console.log(`  📋 Subscription #${i + 1}:`);
      console.log(`     ID: ${sub.id}`);
      console.log(`     Status: ${sub.status}`);
      console.log(`     GBP Account ID: ${sub.gbp_account_id}`);
      console.log(`     User ID: ${sub.user_id}`);
      console.log(`     Plan ID: ${sub.plan_id}`);
      console.log(`     ⭐ Paid Slots: ${sub.paid_slots || 0}`);
      console.log(`     ⭐ Profile Count: ${sub.profile_count || 0}`);
      console.log(`     Trial Start: ${sub.trial_start_date}`);
      console.log(`     Trial End: ${sub.trial_end_date}`);
      console.log(`     Subscription End: ${sub.subscription_end_date}`);
      console.log(`     Last Payment: ${sub.last_payment_date}`);
      console.log(`     Amount: ${sub.amount} ${sub.currency}`);
      console.log(`     Razorpay Payment ID: ${sub.razorpay_payment_id}`);
      console.log(`     Razorpay Order ID: ${sub.razorpay_order_id}`);
      console.log(`     Created: ${sub.created_at}`);
      console.log(`     Updated: ${sub.updated_at}`);
      console.log('');
    });
  }

  // 2. Check payment history
  console.log('\n2️⃣ PAYMENT HISTORY:');
  console.log('-'.repeat(40));

  if (subscriptions && subscriptions.length > 0) {
    for (const sub of subscriptions) {
      const { data: payments, error: payError } = await supabase
        .from('payment_history')
        .select('*')
        .eq('subscription_id', sub.id)
        .order('created_at', { ascending: false });

      if (payError) {
        console.error(`❌ Error querying payments for ${sub.id}:`, payError.message);
      } else if (!payments || payments.length === 0) {
        console.log(`⚠️ No payment history for subscription ${sub.id}`);
      } else {
        console.log(`✅ Found ${payments.length} payment(s) for subscription ${sub.id}:\n`);
        payments.forEach((pay, i) => {
          console.log(`  💳 Payment #${i + 1}:`);
          console.log(`     ID: ${pay.id}`);
          console.log(`     Amount: ${pay.amount} ${pay.currency}`);
          console.log(`     Status: ${pay.status}`);
          console.log(`     Razorpay Payment ID: ${pay.razorpay_payment_id}`);
          console.log(`     Razorpay Order ID: ${pay.razorpay_order_id}`);
          console.log(`     Description: ${pay.description}`);
          console.log(`     Paid At: ${pay.paid_at}`);
          console.log('');
        });
      }
    }
  }

  // 3. Check if there are duplicate entries
  console.log('\n3️⃣ DUPLICATE CHECK:');
  console.log('-'.repeat(40));

  if (subscriptions && subscriptions.length > 1) {
    console.log(`⚠️ WARNING: Found ${subscriptions.length} subscription records for this email!`);
    console.log('   This might cause issues. Consider consolidating.');
  } else if (subscriptions && subscriptions.length === 1) {
    console.log('✅ No duplicates - single subscription record');
  }

  // 4. Analyze the issue
  console.log('\n4️⃣ DIAGNOSIS:');
  console.log('-'.repeat(40));

  if (subscriptions && subscriptions.length > 0) {
    const sub = subscriptions[0];
    const paidSlots = sub.paid_slots || 0;
    const profileCount = sub.profile_count || 0;

    if (paidSlots === 0 && sub.status === 'active') {
      console.log('❌ PROBLEM FOUND: paid_slots is 0 but status is active');
      console.log('   This indicates payment was verified but slots were not updated');
      console.log('   FIX: Update paid_slots to the correct value');
    } else if (paidSlots > 0) {
      console.log(`✅ Paid slots: ${paidSlots}`);
      console.log(`   Profile count: ${profileCount}`);
      console.log(`   Available slots: ${paidSlots - profileCount}`);
    }

    if (sub.status === 'trial') {
      const trialEnd = new Date(sub.trial_end_date);
      const now = new Date();
      if (trialEnd > now) {
        const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
        console.log(`📅 Trial is still active: ${daysRemaining} days remaining`);
      } else {
        console.log('⚠️ Trial has expired');
      }
    }
  }

  console.log('\n==========================================');
  console.log('Check complete');
  console.log('==========================================\n');
}

checkUserSubscription().catch(console.error);
