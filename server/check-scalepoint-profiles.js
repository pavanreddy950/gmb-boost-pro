/**
 * Check profiles for scalepointstrategy@gmail.com
 */

import dotenv from 'dotenv';
dotenv.config();

import automationScheduler from './services/automationScheduler.js';
import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

async function checkScalepointProfiles() {
  console.log('🔍 CHECKING SCALEPOINTSTRATEGY@GMAIL.COM PROFILES\n');
  console.log('===============================================\n');

  try {
    // Initialize services
    await supabaseSubscriptionService.initialize();
    await automationScheduler.loadSettings();

    // Check subscription
    console.log('📧 Checking subscription for scalepointstrategy@gmail.com...\n');

    const allSubs = await supabaseSubscriptionService.getAllSubscriptions();
    const scalepointSub = allSubs.find(s => s.email === 'scalepointstrategy@gmail.com');

    if (scalepointSub) {
      console.log('📊 Subscription Status:');
      console.log(`   Email: ${scalepointSub.email}`);
      console.log(`   Status: ${scalepointSub.status}`);
      console.log(`   Paid Slots: ${scalepointSub.paidSlots}`);
      console.log(`   Profile Count: ${scalepointSub.profileCount}`);
      console.log(`   Trial End: ${scalepointSub.trialEndDate || 'N/A'}`);
      console.log(`   Subscription End: ${scalepointSub.subscriptionEndDate || 'N/A'}`);

      if (scalepointSub.status === 'expired') {
        const expiredDate = new Date(scalepointSub.subscriptionEndDate || scalepointSub.trialEndDate);
        const now = new Date();
        const daysExpired = Math.ceil((now - expiredDate) / (1000 * 60 * 60 * 24));
        console.log(`   ⚠️ EXPIRED ${daysExpired} days ago`);
      }
    } else {
      console.log('❌ No subscription found for scalepointstrategy@gmail.com');
    }

    // Check automation settings
    console.log('\n===============================================\n');
    console.log('📍 Profiles with automation configured:\n');

    const automations = automationScheduler.settings.automations || {};
    const locationIds = Object.keys(automations);

    let scalepointProfiles = [];

    locationIds.forEach(locationId => {
      const config = automations[locationId];
      const userId = config.userId || config.autoPosting?.userId;
      const email = config.email || config.autoPosting?.email;

      // Check if this is a scalepoint profile
      if (email === 'scalepointstrategy@gmail.com' ||
          (userId && userId.includes && userId.includes('scalepoint'))) {
        scalepointProfiles.push({
          locationId,
          businessName: config.businessName || config.autoPosting?.businessName || 'Unknown',
          userId,
          email,
          autoPostingEnabled: config.autoPosting?.enabled,
          autoReplyEnabled: config.autoReply?.enabled
        });
      }
    });

    if (scalepointProfiles.length === 0) {
      console.log('❌ No profiles found with scalepointstrategy@gmail.com email');
      console.log('\n💡 Searching by GBP Account ID instead...\n');

      // Try to find by GBP account ID
      if (scalepointSub) {
        const gbpAccountId = scalepointSub.gbpAccountId;

        locationIds.forEach(locationId => {
          const config = automations[locationId];
          if (config.gbpAccountId === gbpAccountId) {
            scalepointProfiles.push({
              locationId,
              businessName: config.businessName || config.autoPosting?.businessName || 'Unknown',
              userId: config.userId || config.autoPosting?.userId,
              email: config.email || config.autoPosting?.email,
              autoPostingEnabled: config.autoPosting?.enabled,
              autoReplyEnabled: config.autoReply?.enabled
            });
          }
        });
      }
    }

    if (scalepointProfiles.length > 0) {
      console.log(`✅ Found ${scalepointProfiles.length} profile(s):\n`);

      scalepointProfiles.forEach((profile, index) => {
        console.log(`${index + 1}. ${profile.businessName}`);
        console.log(`   Location ID: ${profile.locationId}`);
        console.log(`   User ID: ${profile.userId}`);
        console.log(`   Email: ${profile.email || 'N/A'}`);
        console.log(`   Auto-posting: ${profile.autoPostingEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log(`   Auto-reply: ${profile.autoReplyEnabled ? '✅ Enabled' : '❌ Disabled'}`);
        console.log('');
      });
    } else {
      console.log('❌ No profiles found for scalepointstrategy@gmail.com');
    }

    console.log('===============================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkScalepointProfiles();
