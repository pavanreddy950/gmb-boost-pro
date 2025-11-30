import supabaseAutomationService from './services/supabaseAutomationService.js';
import automationScheduler from './services/automationScheduler.js';

/**
 * Debug script to check automation settings in Supabase
 * Run with: node server/debug-automation-settings.js
 */

async function debugAutomationSettings() {
  console.log('========================================');
  console.log('🔍 AUTOMATION SETTINGS DIAGNOSTIC');
  console.log('========================================\n');

  try {
    // Get all enabled automations from Supabase
    console.log('📥 Fetching all enabled automations from Supabase...\n');
    const allAutomations = await supabaseAutomationService.getAllEnabledAutomations();

    console.log(`✅ Found ${allAutomations.length} enabled automation(s)\n`);

    if (allAutomations.length === 0) {
      console.log('⚠️ No enabled automations found in database!');
      console.log('💡 This means no locations are set up for auto-posting.');
      console.log('');

      // Check if there are ANY automation settings (even disabled ones)
      console.log('🔍 Checking for ALL automation settings (including disabled)...');
      const { data: allSettings } = await supabaseAutomationService.client
        .from('automation_settings')
        .select('*');

      if (allSettings && allSettings.length > 0) {
        console.log(`\n📊 Found ${allSettings.length} total automation setting(s):`);
        allSettings.forEach((setting, index) => {
          console.log(`\n${index + 1}. Location: ${setting.location_id}`);
          console.log(`   - User ID: ${setting.user_id}`);
          console.log(`   - Enabled: ${setting.enabled} ⚠️`);
          console.log(`   - Business Name: ${setting.settings?.autoPosting?.businessName || 'N/A'}`);
          console.log(`   - Frequency: ${setting.settings?.autoPosting?.frequency || 'N/A'}`);
          console.log(`   - Schedule: ${setting.settings?.autoPosting?.schedule || 'N/A'}`);
          console.log(`   - Last Run: ${setting.settings?.autoPosting?.lastRun || 'NEVER'}`);
        });
      } else {
        console.log('\n❌ No automation settings found in database at all!');
      }
    } else {
      // Display details for each enabled automation
      console.log('📊 ENABLED AUTOMATION DETAILS:\n');
      allAutomations.forEach((automation, index) => {
        console.log(`${index + 1}. Location ID: ${automation.locationId}`);
        console.log(`   ========================================`);
        console.log(`   User ID: ${automation.userId}`);
        console.log(`   Business Name: ${automation.autoPosting?.businessName || 'N/A'}`);
        console.log(`   Category: ${automation.autoPosting?.category || 'N/A'}`);
        console.log(`   `);
        console.log(`   AUTO-POSTING:`);
        console.log(`   - Enabled: ${automation.autoPosting?.enabled}`);
        console.log(`   - Frequency: ${automation.autoPosting?.frequency || 'NOT SET'} ⚠️`);
        console.log(`   - Schedule Time: ${automation.autoPosting?.schedule || 'NOT SET'} ⚠️`);
        console.log(`   - Last Run: ${automation.autoPosting?.lastRun || 'NEVER'}`);
        console.log(`   - Keywords: ${automation.autoPosting?.keywords?.substring(0, 100) || 'NONE'}...`);
        console.log(`   `);
        console.log(`   ADDRESS INFO:`);
        console.log(`   - City: ${automation.autoPosting?.city || 'NOT SET'}`);
        console.log(`   - Region: ${automation.autoPosting?.region || 'NOT SET'}`);
        console.log(`   - Full Address: ${automation.autoPosting?.fullAddress || 'NOT SET'}`);
        console.log(`   `);
        console.log(`   AUTO-REPLY:`);
        console.log(`   - Enabled: ${automation.autoReply?.enabled || false}`);
        console.log(`   `);
        console.log(`   UPDATED: ${automation.updatedAt || 'N/A'}`);
        console.log(`   ========================================\n`);
      });
    }

    // Check what's currently scheduled in memory
    console.log('\n🔍 CHECKING IN-MEMORY SCHEDULER STATE:\n');
    console.log('Loading current automation settings from scheduler...');
    await automationScheduler.loadSettings();

    const automations = automationScheduler.settings.automations || {};
    const locationIds = Object.keys(automations);

    console.log(`\n✅ Found ${locationIds.length} location(s) loaded in scheduler:\n`);

    locationIds.forEach((locationId, index) => {
      const config = automations[locationId];
      console.log(`${index + 1}. Location: ${locationId}`);
      console.log(`   - Business: ${config.autoPosting?.businessName || 'N/A'}`);
      console.log(`   - Auto-posting enabled: ${config.autoPosting?.enabled || false}`);
      console.log(`   - Frequency: ${config.autoPosting?.frequency || 'NOT SET'}`);
      console.log(`   - Schedule: ${config.autoPosting?.schedule || 'NOT SET'}`);
      console.log(`   - Last run: ${config.autoPosting?.lastRun || 'NEVER'}`);
      console.log(`   - Has cron job: ${automationScheduler.scheduledJobs.has(locationId)}`);
      console.log('');
    });

    // Check active cron jobs
    console.log('\n⏰ ACTIVE CRON JOBS:\n');
    console.log(`Total scheduled jobs: ${automationScheduler.scheduledJobs.size}`);
    console.log(`Total review monitors: ${automationScheduler.reviewCheckIntervals.size}\n`);

    for (const [locationId, job] of automationScheduler.scheduledJobs) {
      const config = automations[locationId];
      console.log(`📅 Location: ${locationId}`);
      console.log(`   - Business: ${config?.autoPosting?.businessName || 'N/A'}`);
      console.log(`   - Frequency: ${config?.autoPosting?.frequency || 'N/A'}`);
      console.log(`   - Schedule: ${config?.autoPosting?.schedule || 'N/A'}`);
      console.log(`   - Next run: Cron job active ✅`);
      console.log('');
    }

    // DIAGNOSTIC SUMMARY
    console.log('\n========================================');
    console.log('📋 DIAGNOSTIC SUMMARY');
    console.log('========================================\n');

    const dbEnabledCount = allAutomations.length;
    const memoryLoadedCount = locationIds.length;
    const activeCronCount = automationScheduler.scheduledJobs.size;

    console.log(`✅ Enabled in database: ${dbEnabledCount}`);
    console.log(`✅ Loaded in scheduler: ${memoryLoadedCount}`);
    console.log(`✅ Active cron jobs: ${activeCronCount}`);
    console.log('');

    if (dbEnabledCount === 0) {
      console.log('⚠️  ISSUE DETECTED: No enabled automations in database!');
      console.log('💡 SOLUTION: Check the frontend UI - ensure automations are enabled and saved.');
    } else if (dbEnabledCount !== memoryLoadedCount) {
      console.log('⚠️  ISSUE DETECTED: Database count ≠ Memory count');
      console.log('💡 SOLUTION: Restart the backend server to reload settings from database.');
    } else if (memoryLoadedCount !== activeCronCount) {
      console.log('⚠️  ISSUE DETECTED: Not all loaded automations have cron jobs!');
      console.log('💡 SOLUTION: Check that each automation has valid frequency + schedule.');
    } else {
      console.log('✅ All systems appear to be working correctly!');
    }

    console.log('');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Error during diagnostic:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

debugAutomationSettings();
