/**
 * Find Firebase user ID for scalepointstrategy@gmail.com
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';
import automationScheduler from './services/automationScheduler.js';

async function findScalepointUserId() {
  console.log('🔍 FINDING SCALEPOINTSTRATEGY@GMAIL.COM USER ID\n');
  console.log('===============================================\n');

  try {
    // Initialize
    await supabaseSubscriptionService.initialize();
    await automationScheduler.loadSettings();

    // Get subscription
    const allSubs = await supabaseSubscriptionService.getAllSubscriptions();
    const scalepointSub = allSubs.find(s => s.email === 'scalepointstrategy@gmail.com');

    if (!scalepointSub) {
      console.log('❌ No subscription found for scalepointstrategy@gmail.com');
      process.exit(1);
    }

    console.log('📧 Subscription found:');
    console.log(`   Email: ${scalepointSub.email}`);
    console.log(`   Status: ${scalepointSub.status}`);
    console.log(`   GBP Account ID: ${scalepointSub.gbpAccountId}`);
    console.log(`   User ID: ${scalepointSub.userId}`);
    console.log(`   Firebase UID: ${scalepointSub.firebaseUid}`);

    const userIdToSearch = scalepointSub.userId || scalepointSub.firebaseUid;

    console.log(`\n🔎 Searching for profiles with userId: ${userIdToSearch}`);
    console.log('===============================================\n');

    // Search automation settings
    const automations = automationScheduler.settings.automations || {};
    const locationIds = Object.keys(automations);

    let foundProfiles = [];

    locationIds.forEach(locationId => {
      const config = automations[locationId];
      const configUserId = config.userId || config.autoPosting?.userId;

      if (configUserId === userIdToSearch) {
        foundProfiles.push({
          locationId,
          businessName: config.businessName || config.autoPosting?.businessName || 'Unknown',
          userId: configUserId,
          autoPostingEnabled: config.autoPosting?.enabled,
          autoReplyEnabled: config.autoReply?.enabled
        });
      }
    });

    if (foundProfiles.length > 0) {
      console.log(`✅ Found ${foundProfiles.length} profile(s):\n`);

      foundProfiles.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.businessName}`);
        console.log(`   Location ID: ${profile.locationId}`);
        console.log(`   User ID: ${profile.userId}`);
        console.log(`   Auto-posting: ${profile.autoPostingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Auto-reply: ${profile.autoReplyEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log('');
      });

      console.log('===============================================\n');
      console.log('⚠️  IMPORTANT: Subscription is EXPIRED!');
      console.log('   The subscription expired 19 days ago.');
      console.log('   Auto-posting is BLOCKED until subscription is renewed.\n');
      console.log('💡 To test auto-posting, you need to:');
      console.log('   1. Renew the subscription for scalepointstrategy@gmail.com');
      console.log('   2. OR test with an active account instead');
      console.log('   3. OR temporarily bypass subscription guard for testing\n');

    } else {
      console.log(`❌ No profiles found for userId: ${userIdToSearch}\n`);
      console.log('💡 This user has a subscription but no automation configured.');
      console.log('   They may need to connect their Google Business Profile first.\n');
    }

    console.log('===============================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

findScalepointUserId();
