/**
 * Trigger auto-posts NOW for all profiles
 */

import dotenv from 'dotenv';
dotenv.config();

import automationScheduler from './services/automationScheduler.js';

async function triggerAllPostsNow() {
  console.log('🚀 TRIGGERING AUTO-POSTS FOR ALL PROFILES NOW');
  console.log('===============================================\n');

  try {
    // Initialize and load settings from Supabase
    await automationScheduler.loadSettings();

    const automations = automationScheduler.settings.automations || {};
    const locationIds = Object.keys(automations);

    console.log(`📍 Found ${locationIds.length} location(s) with automation configured\n`);

    if (locationIds.length === 0) {
      console.log('❌ No locations found with automation settings');
      process.exit(0);
    }

    // Filter for scalepointstrategy@gmail.com profiles
    const scalePointLocations = locationIds.filter(locationId => {
      const config = automations[locationId];
      const userId = config.userId || config.autoPosting?.userId;
      return userId && userId.includes('scalepointstrategy');
    });

    console.log(`✅ Found ${scalePointLocations.length} location(s) for scalepointstrategy@gmail.com\n`);

    if (scalePointLocations.length === 0) {
      console.log('⚠️ No locations found for scalepointstrategy@gmail.com');
      console.log('📋 Available users in automation:');
      locationIds.forEach(locationId => {
        const config = automations[locationId];
        const userId = config.userId || config.autoPosting?.userId;
        console.log(`   - Location ${locationId}: userId = ${userId}`);
      });

      console.log('\n🔄 Will trigger posts for ALL locations instead...');
    }

    const locationsToTrigger = scalePointLocations.length > 0 ? scalePointLocations : locationIds;

    // Trigger posts for each location
    for (const locationId of locationsToTrigger) {
      const config = automations[locationId];
      const businessName = config.businessName || config.autoPosting?.businessName || 'Unknown';
      const userId = config.userId || config.autoPosting?.userId || 'default';

      console.log(`\n📍 Location: ${locationId}`);
      console.log(`   Business: ${businessName}`);
      console.log(`   User: ${userId}`);
      console.log(`   Creating post NOW...\n`);

      try {
        // Use autoPosting config if available, otherwise use full config
        const postConfig = config.autoPosting || config;
        const result = await automationScheduler.createAutomatedPost(locationId, postConfig);

        if (result) {
          console.log(`   ✅ Post created successfully for ${businessName}`);
          console.log(`   📋 Post ID: ${result.name || result.id || 'Unknown'}`);
        } else {
          console.log(`   ❌ Post creation failed for ${businessName}`);
        }
      } catch (error) {
        console.error(`   ❌ Error creating post for ${businessName}:`, error.message);
      }

      // Wait 3 seconds between posts to avoid rate limiting
      if (locationsToTrigger.indexOf(locationId) < locationsToTrigger.length - 1) {
        console.log(`\n   ⏳ Waiting 3 seconds before next post...\n`);
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    console.log('\n===============================================');
    console.log('✅ ALL POSTS TRIGGERED!');
    console.log('===============================================');
    console.log('\n📊 Summary:');
    console.log(`   - Total locations: ${locationsToTrigger.length}`);
    console.log(`   - Posts triggered: ${locationsToTrigger.length}`);
    console.log('\n🔍 Check your Google Business Profile to see the posts!');
    console.log('📞 Verify that posts have "Call Now" button\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

triggerAllPostsNow();
