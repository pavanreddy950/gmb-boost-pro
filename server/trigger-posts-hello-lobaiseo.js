/**
 * Trigger auto-posts NOW for hello.lobaiseo@gmail.com profiles
 */

import dotenv from 'dotenv';
dotenv.config();

import automationScheduler from './services/automationScheduler.js';
import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

async function triggerPostsForHelloLobaiseo() {
  console.log('🚀 TRIGGERING AUTO-POSTS FOR hello.lobaiseo@gmail.com\n');
  console.log('===============================================\n');

  try {
    // Initialize services
    await supabaseSubscriptionService.initialize();
    await automationScheduler.loadSettings();

    // Get subscription info
    const allSubs = await supabaseSubscriptionService.getAllSubscriptions();
    const helloSub = allSubs.find(s => s.email === 'hello.lobaiseo@gmail.com');

    if (!helloSub) {
      console.log('❌ No subscription found for hello.lobaiseo@gmail.com');
      process.exit(1);
    }

    console.log('📊 Subscription Status:');
    console.log(`   Email: ${helloSub.email}`);
    console.log(`   Status: ${helloSub.status}`);
    console.log(`   Paid Slots: ${helloSub.paidSlots}`);
    console.log(`   Profile Count: ${helloSub.profileCount}`);
    console.log(`   Subscription End: ${helloSub.subscriptionEndDate}`);

    if (helloSub.status !== 'active' && helloSub.status !== 'paid') {
      console.log(`\n⚠️  Subscription status is "${helloSub.status}" - auto-posting may be blocked!`);
    }

    const userIdToSearch = helloSub.userId || helloSub.firebaseUid;

    console.log(`\n🔎 Finding profiles for userId: ${userIdToSearch}`);
    console.log('===============================================\n');

    // Find all profiles
    const automations = automationScheduler.settings.automations || {};
    const locationIds = Object.keys(automations);

    let helloProfiles = [];

    locationIds.forEach(locationId => {
      const config = automations[locationId];
      const configUserId = config.userId || config.autoPosting?.userId;

      if (configUserId === userIdToSearch) {
        helloProfiles.push({
          locationId,
          businessName: config.businessName || config.autoPosting?.businessName || 'Unknown',
          config: config
        });
      }
    });

    if (helloProfiles.length === 0) {
      console.log('❌ No profiles found for hello.lobaiseo@gmail.com');
      process.exit(0);
    }

    console.log(`✅ Found ${helloProfiles.length} profile(s):\n`);

    helloProfiles.forEach((profile, index) => {
      console.log(`${index + 1}. ${profile.businessName}`);
      console.log(`   Location ID: ${profile.locationId}`);
    });

    console.log('\n===============================================\n');
    console.log('🚀 TRIGGERING AUTO-POSTS NOW...\n');

    let successCount = 0;
    let failureCount = 0;

    // Trigger posts for each profile
    for (const profile of helloProfiles) {
      const { locationId, businessName, config } = profile;

      console.log(`\n📍 Location: ${locationId}`);
      console.log(`   Business: ${businessName}`);
      console.log(`   Creating post NOW...\n`);

      try {
        // Use autoPosting config if available, otherwise use full config
        const postConfig = config.autoPosting || config;
        const result = await automationScheduler.createAutomatedPost(locationId, postConfig);

        if (result) {
          console.log(`   ✅ Post created successfully for ${businessName}`);
          console.log(`   📋 Post ID: ${result.name || result.id || 'Unknown'}`);
          console.log(`   🔘 CTA Button: ${result.callToAction?.actionType || 'Unknown'}`);
          successCount++;
        } else {
          console.log(`   ❌ Post creation failed for ${businessName}`);
          failureCount++;
        }
      } catch (error) {
        console.error(`   ❌ Error creating post for ${businessName}:`, error.message);
        failureCount++;
      }

      // Wait 3 seconds between posts to avoid rate limiting
      if (helloProfiles.indexOf(profile) < helloProfiles.length - 1) {
        console.log(`\n   ⏳ Waiting 3 seconds before next post...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n===============================================');
    console.log('✅ AUTO-POSTING COMPLETE!');
    console.log('===============================================');
    console.log('\n📊 Summary:');
    console.log(`   - Total profiles: ${helloProfiles.length}`);
    console.log(`   - Successful posts: ${successCount}`);
    console.log(`   - Failed posts: ${failureCount}`);
    console.log('\n🔍 Check your Google Business Profile to see the posts!');
    console.log('📞 Verify that posts have "Call Now" button\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

triggerPostsForHelloLobaiseo();
