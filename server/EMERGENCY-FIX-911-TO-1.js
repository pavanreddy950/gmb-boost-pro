/**
 * 🚨 EMERGENCY FIX - 911 Profiles Bug
 *
 * This script will:
 * 1. Find your subscription
 * 2. Set paidSlots to 1 (the correct number)
 * 3. Set profileCount to 1
 *
 * RUN THIS IMMEDIATELY: node EMERGENCY-FIX-911-TO-1.js
 */

// CRITICAL: Load environment variables first!
import dotenv from 'dotenv';
dotenv.config();

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

async function emergencyFix() {
  console.log('🚨 EMERGENCY FIX - Setting subscription to 1 profile\n');

  try {
    await supabaseSubscriptionService.initialize();
    console.log('✅ Connected to database\n');

    // Get all active subscriptions
    const allSubs = await supabaseSubscriptionService.getAllSubscriptions();
    const activeSubs = allSubs.filter(s => s.status === 'active' || s.status === 'paid');

    console.log(`Found ${activeSubs.length} active subscriptions:\n`);

    for (const sub of activeSubs) {
      console.log(`📧 ${sub.email || sub.gbpAccountId}`);
      console.log(`   Current paidSlots: ${sub.paidSlots}`);
      console.log(`   Status: ${sub.status}`);

      // Check if this subscription has the bug (911 or 91 profiles)
      if (sub.paidSlots === 911 || sub.paidSlots === '911' || sub.paidSlots === 91 || sub.paidSlots === '91') {
        console.log(`   🚨 BUG DETECTED! Fixing to 1 profile...\n`);

        // Fix it to 1 profile
        await supabaseSubscriptionService.updateSubscription(sub.gbpAccountId, {
          paidSlots: 1,
          profileCount: 1
        });

        console.log(`   ✅ FIXED! ${sub.email || sub.gbpAccountId} now has 1 profile\n`);
      } else if (sub.paidSlots > 50) {
        console.log(`   ⚠️ SUSPICIOUS: Has ${sub.paidSlots} profiles (more than 50)`);
        console.log(`   This might be the bug. Do you want to fix this to 1? (Edit script if yes)\n`);
      } else {
        console.log(`   ✅ Looks OK (${sub.paidSlots} profiles)\n`);
      }
    }

    console.log('✅ Emergency fix completed!\n');
    console.log('🔄 Please RESTART your backend server and REFRESH your browser.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

emergencyFix()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
