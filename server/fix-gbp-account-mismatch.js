/**
 * FIX CRITICAL ISSUE: GBP Account ID mismatch in automation settings
 *
 * Problem: Automation settings have wrong GBP Account IDs
 * Solution: Update all automation settings with correct GBP Account IDs from subscriptions
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';
import supabaseConfig from './config/supabase.js';

async function fixGbpAccountMismatch() {
  console.log('🔧 FIXING GBP ACCOUNT ID MISMATCH\n');
  console.log('===============================================\n');

  try {
    // Initialize
    await supabaseSubscriptionService.initialize();
    const supabase = await supabaseConfig.ensureInitialized();

    // Get all subscriptions
    console.log('📊 Step 1: Loading all subscriptions...\n');
    const allSubscriptions = await supabaseSubscriptionService.getAllSubscriptions();
    console.log(`Found ${allSubscriptions.length} subscriptions\n`);

    // Get all automation settings
    console.log('📊 Step 2: Loading all automation settings...\n');
    const { data: automationSettings, error: autoError } = await supabase
      .from('automation_settings')
      .select('*');

    if (autoError) {
      throw autoError;
    }

    console.log(`Found ${automationSettings.length} automation settings\n`);

    console.log('===============================================\n');
    console.log('🔍 Checking for mismatches...\n');

    let fixCount = 0;
    let skipCount = 0;

    // Group automation settings by userId
    const settingsByUser = {};
    automationSettings.forEach(setting => {
      const userId = setting.user_id;
      if (!settingsByUser[userId]) {
        settingsByUser[userId] = [];
      }
      settingsByUser[userId].push(setting);
    });

    // For each user, find their correct GBP Account ID
    for (const [userId, settings] of Object.entries(settingsByUser)) {
      console.log(`\n👤 User: ${userId}`);
      console.log(`   Settings: ${settings.length} location(s)`);

      // Find subscription for this user
      const subscription = allSubscriptions.find(s => s.userId === userId);

      if (!subscription) {
        console.log(`   ⚠️  No subscription found - skipping`);
        skipCount += settings.length;
        continue;
      }

      const correctGbpAccountId = subscription.gbpAccountId;
      console.log(`   ✅ Subscription found:`);
      console.log(`      Email: ${subscription.email}`);
      console.log(`      Status: ${subscription.status}`);
      console.log(`      Correct GBP Account ID: ${correctGbpAccountId}`);
      console.log(`      Paid Slots: ${subscription.paidSlots}`);

      // Check each setting
      let userFixCount = 0;
      for (const setting of settings) {
        const currentGbpAccountId = setting.settings?.gbpAccountId ||
                                      setting.settings?.autoPosting?.gbpAccountId ||
                                      null;

        console.log(`\n   📍 Location: ${setting.location_id}`);
        console.log(`      Current GBP Account ID: ${currentGbpAccountId || 'NOT SET'}`);

        if (currentGbpAccountId !== correctGbpAccountId) {
          console.log(`      ⚠️  MISMATCH DETECTED! Fixing...`);

          // Update the settings with correct GBP Account ID
          const updatedSettings = {
            ...setting.settings,
            gbpAccountId: correctGbpAccountId,
            autoPosting: {
              ...setting.settings?.autoPosting,
              gbpAccountId: correctGbpAccountId
            },
            autoReply: {
              ...setting.settings?.autoReply,
              gbpAccountId: correctGbpAccountId
            }
          };

          // Update in database
          const { error: updateError } = await supabase
            .from('automation_settings')
            .update({
              settings: updatedSettings,
              updated_at: new Date().toISOString()
            })
            .eq('id', setting.id);

          if (updateError) {
            console.log(`      ❌ Failed to update: ${updateError.message}`);
          } else {
            console.log(`      ✅ FIXED! Updated to: ${correctGbpAccountId}`);
            userFixCount++;
            fixCount++;
          }
        } else {
          console.log(`      ✅ Already correct - no change needed`);
          skipCount++;
        }
      }

      if (userFixCount > 0) {
        console.log(`\n   🎉 Fixed ${userFixCount} location(s) for user ${userId}`);
      }
    }

    console.log('\n===============================================');
    console.log('✅ FIX COMPLETE!');
    console.log('===============================================');
    console.log('\n📊 Summary:');
    console.log(`   - Total automation settings: ${automationSettings.length}`);
    console.log(`   - Fixed: ${fixCount}`);
    console.log(`   - Already correct: ${skipCount}`);
    console.log('\n💡 Next steps:');
    console.log('   - Test auto-posting again');
    console.log('   - Subscription validation should now work correctly\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
}

fixGbpAccountMismatch();
