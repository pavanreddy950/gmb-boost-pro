/**
 * EMERGENCY FIX SCRIPT
 * Fixes the 91 profiles bug where trial profileCount was incorrectly added to paid slots
 *
 * Run this script to correct affected subscriptions
 */

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

async function fixProfileCountBug() {
  console.log('🚨 EMERGENCY FIX: Correcting profile count bug...\n');

  try {
    // Initialize Supabase
    await supabaseSubscriptionService.initialize();
    console.log('✅ Connected to database\n');

    // Get all subscriptions
    const allSubscriptions = await supabaseSubscriptionService.getAllSubscriptions();
    console.log(`📊 Found ${allSubscriptions.length} total subscriptions\n`);

    // Find affected subscriptions (active/paid with suspicious paidSlots)
    const affectedSubscriptions = allSubscriptions.filter(sub => {
      const isActive = sub.status === 'active' || sub.status === 'paid';
      const hasSuspiciousCount = sub.paidSlots > 50; // Anything over 50 is suspicious for a new platform
      return isActive && hasSuspiciousCount;
    });

    console.log(`🔍 Found ${affectedSubscriptions.length} potentially affected subscriptions:\n`);

    for (const sub of affectedSubscriptions) {
      console.log(`❌ AFFECTED: ${sub.email || sub.gbpAccountId}`);
      console.log(`   - Current paidSlots: ${sub.paidSlots}`);
      console.log(`   - Status: ${sub.status}`);
      console.log(`   - Payment history: ${sub.paymentHistory?.length || 0} payments`);

      // Check payment history to determine correct paid slots
      if (sub.paymentHistory && sub.paymentHistory.length > 0) {
        const latestPayment = sub.paymentHistory[0];
        console.log(`   - Latest payment: ${latestPayment.description}`);

        // Try to extract profile count from payment description
        const match = latestPayment.description?.match(/(\d+) profile/i);
        if (match) {
          const correctProfileCount = parseInt(match[1]);
          console.log(`   - ✅ Should be: ${correctProfileCount} profile(s)\n`);

          // Ask for confirmation before fixing (in production, you'd want manual approval)
          console.log(`   FIX: Setting paidSlots from ${sub.paidSlots} to ${correctProfileCount}`);

          // Update the subscription
          await supabaseSubscriptionService.updateSubscription(sub.gbpAccountId, {
            paidSlots: correctProfileCount,
            profileCount: correctProfileCount
          });

          console.log(`   ✅ FIXED: ${sub.email || sub.gbpAccountId}\n`);
        } else {
          console.log(`   ⚠️ Could not determine correct profile count from payment history`);
          console.log(`   MANUAL ACTION NEEDED: Check this subscription manually\n`);
        }
      } else {
        console.log(`   ⚠️ No payment history found`);
        console.log(`   MANUAL ACTION NEEDED: Check this subscription manually\n`);
      }
    }

    // Also show recent subscriptions for manual review
    console.log('\n📋 Recent subscriptions (last 5):');
    const recentSubs = allSubscriptions.slice(0, 5);
    for (const sub of recentSubs) {
      console.log(`   - ${sub.email || sub.gbpAccountId}: ${sub.paidSlots || 0} slots (${sub.status})`);
    }

    console.log('\n✅ Fix script completed!');

  } catch (error) {
    console.error('❌ Error running fix script:', error);
    throw error;
  }
}

// Run the fix
fixProfileCountBug()
  .then(() => {
    console.log('\n✅ All done!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
