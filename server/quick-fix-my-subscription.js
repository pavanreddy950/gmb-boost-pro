/**
 * QUICK FIX - Manually set your subscription to the correct profile count
 *
 * Usage: Edit the values below and run: node quick-fix-my-subscription.js
 */

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

// ========================================
// EDIT THESE VALUES:
// ========================================
const YOUR_EMAIL = 'your-email@example.com'; // Replace with your actual email
const CORRECT_PROFILE_COUNT = 1; // How many profiles did you actually pay for?
// ========================================

async function quickFix() {
  console.log('🔧 Quick Fix Script Starting...\n');

  try {
    await supabaseSubscriptionService.initialize();
    console.log('✅ Connected to database\n');

    // Find subscription by email
    console.log(`🔍 Looking for subscription with email: ${YOUR_EMAIL}`);
    const subscription = await supabaseSubscriptionService.getSubscriptionByEmail(YOUR_EMAIL);

    if (!subscription) {
      console.error(`❌ No subscription found for email: ${YOUR_EMAIL}`);
      console.log('\n💡 Make sure you entered the correct email address');
      process.exit(1);
    }

    console.log(`✅ Found subscription:`);
    console.log(`   - ID: ${subscription.id}`);
    console.log(`   - Status: ${subscription.status}`);
    console.log(`   - Current paidSlots: ${subscription.paidSlots || 0}`);
    console.log(`   - Current profileCount: ${subscription.profileCount || 0}\n`);

    console.log(`🔄 Updating to correct values:`);
    console.log(`   - paidSlots: ${subscription.paidSlots} → ${CORRECT_PROFILE_COUNT}`);
    console.log(`   - profileCount: ${subscription.profileCount} → ${CORRECT_PROFILE_COUNT}\n`);

    // Update subscription
    await supabaseSubscriptionService.updateSubscription(subscription.gbpAccountId, {
      paidSlots: CORRECT_PROFILE_COUNT,
      profileCount: CORRECT_PROFILE_COUNT
    });

    console.log('✅ SUBSCRIPTION FIXED!\n');
    console.log(`Your subscription now has ${CORRECT_PROFILE_COUNT} profile(s) as it should.`);
    console.log('\n🔄 Please refresh your browser to see the updated profile count.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

quickFix()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
