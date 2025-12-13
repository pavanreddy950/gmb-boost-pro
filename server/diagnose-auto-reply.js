import supabaseConfig from './config/supabase.js';

/**
 * DIAGNOSTIC SCRIPT: Auto-Reply Not Working
 *
 * This script checks why auto-reply is not working and provides fixes
 */

async function diagnoseAutoReply() {
  console.log('========================================');
  console.log('AUTO-REPLY DIAGNOSTIC TOOL');
  console.log('========================================\n');

  try {
    // Initialize Supabase
    const client = await supabaseConfig.ensureInitialized();
    console.log('✅ Supabase connected\n');

    // Step 1: Check all automation settings
    console.log('STEP 1: Checking automation settings in database...');
    console.log('-------------------------------------------');

    const { data: allSettings, error: settingsError } = await client
      .from('automation_settings')
      .select('*')
      .order('updated_at', { ascending: false });

    if (settingsError) {
      console.error('❌ Error fetching settings:', settingsError);
      return;
    }

    if (!allSettings || allSettings.length === 0) {
      console.error('❌ NO AUTOMATION SETTINGS FOUND IN DATABASE!');
      console.error('   This means auto-reply has never been configured.');
      console.error('\n💡 SOLUTION: User needs to enable auto-reply in Settings page.');
      return;
    }

    console.log(`✅ Found ${allSettings.length} automation setting(s)\n`);

    // Step 2: Check each location's auto-reply status
    console.log('STEP 2: Checking auto-reply status for each location...');
    console.log('-------------------------------------------');

    for (const setting of allSettings) {
      const locationId = setting.location_id;
      const businessName = setting.settings?.businessName || setting.settings?.autoPosting?.businessName || 'Unknown';

      console.log(`\n📍 Location: ${businessName} (${locationId})`);
      console.log(`   User ID: ${setting.user_id}`);
      console.log(`   Automation Enabled: ${setting.enabled ? '✅ YES' : '❌ NO'}`);
      console.log(`   Auto-Reply Enabled: ${setting.auto_reply_enabled ? '✅ YES' : '❌ NO'}`);
      console.log(`   Last Updated: ${new Date(setting.updated_at).toLocaleString()}`);

      // Check detailed settings
      const autoReplySettings = setting.settings?.autoReply;
      if (autoReplySettings) {
        console.log(`   Auto-Reply Config:`);
        console.log(`     - Enabled in settings: ${autoReplySettings.enabled ? '✅ YES' : '❌ NO'}`);
        console.log(`     - Reply to All: ${autoReplySettings.replyToAll ? '✅ YES' : '❌ NO'}`);
        console.log(`     - Keywords: ${autoReplySettings.keywords || 'NOT SET'}`);
      } else {
        console.log(`   ⚠️  Auto-Reply Config: MISSING in settings JSONB`);
      }

      // Diagnosis
      if (!setting.enabled) {
        console.log(`\n   ❌ PROBLEM: Automation is DISABLED for this location!`);
        console.log(`   💡 FIX: Enable automation in Settings page for this location.`);
      } else if (!setting.auto_reply_enabled) {
        console.log(`\n   ❌ PROBLEM: Auto-reply is DISABLED for this location!`);
        console.log(`   💡 FIX: Enable auto-reply toggle in Settings page for this location.`);
      } else if (!autoReplySettings || !autoReplySettings.enabled) {
        console.log(`\n   ❌ PROBLEM: Auto-reply settings are missing or disabled!`);
        console.log(`   💡 FIX: Re-configure auto-reply in Settings page.`);
      } else {
        console.log(`\n   ✅ Auto-reply is PROPERLY CONFIGURED for this location!`);
        console.log(`   💡 Next: Check if scheduler is running the review monitor.`);
      }
    }

    // Step 3: Check for recent review reply attempts
    console.log('\n\nSTEP 3: Checking recent automation activity...');
    console.log('-------------------------------------------');

    const { data: recentActivity, error: activityError } = await client
      .from('automation_activity_logs')
      .select('*')
      .eq('action_type', 'review_replied')
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityError) {
      console.error('❌ Error fetching activity logs:', activityError);
    } else if (!recentActivity || recentActivity.length === 0) {
      console.log('❌ NO REVIEW REPLIES FOUND in activity logs!');
      console.log('   This confirms auto-reply has NOT been working.');
    } else {
      console.log(`✅ Found ${recentActivity.length} recent review replies:\n`);
      recentActivity.forEach(log => {
        console.log(`   - ${new Date(log.created_at).toLocaleString()}: ${log.status}`);
        console.log(`     Location: ${log.location_id}`);
      });
    }

    // Step 4: Check for failed review checks
    console.log('\n\nSTEP 4: Checking for failed review check attempts...');
    console.log('-------------------------------------------');

    const { data: failedChecks, error: failedError } = await client
      .from('automation_activity_logs')
      .select('*')
      .in('action_type', ['review_check_failed', 'reply_failed'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (failedError) {
      console.error('❌ Error fetching failed checks:', failedError);
    } else if (!failedChecks || failedChecks.length === 0) {
      console.log('ℹ️  No failed review checks found.');
      console.log('   This means the scheduler is NOT even trying to check reviews!');
      console.log('   💡 FIX: Restart the backend server to reload automations.');
    } else {
      console.log(`⚠️  Found ${failedChecks.length} failed attempts:\n`);
      failedChecks.forEach(log => {
        console.log(`   - ${new Date(log.created_at).toLocaleString()}`);
        console.log(`     Status: ${log.status}`);
        console.log(`     Error: ${log.error_message || 'Unknown'}`);
      });
    }

    // Final Summary
    console.log('\n\n========================================');
    console.log('DIAGNOSTIC SUMMARY');
    console.log('========================================');

    const enabledLocations = allSettings.filter(s => s.enabled && s.auto_reply_enabled);

    if (enabledLocations.length === 0) {
      console.log('❌ NO LOCATIONS have auto-reply enabled!');
      console.log('\n💡 ACTION REQUIRED:');
      console.log('   1. Open the app Settings page');
      console.log('   2. Enable automation for your location(s)');
      console.log('   3. Enable the auto-reply toggle');
      console.log('   4. Restart the backend server');
    } else {
      console.log(`✅ ${enabledLocations.length} location(s) have auto-reply enabled.`);

      if (!recentActivity || recentActivity.length === 0) {
        console.log('\n❌ But NO replies have been sent!');
        console.log('\n💡 MOST LIKELY ISSUES:');
        console.log('   1. Backend server needs restart to load settings');
        console.log('   2. Check interval was too long (10 min → fixed to 2 min)');
        console.log('   3. Subscription may have expired (blocking replies)');
        console.log('   4. Google OAuth token may have expired');
        console.log('\n💡 ACTION REQUIRED:');
        console.log('   1. Restart the backend server NOW');
        console.log('   2. Check browser console for errors');
        console.log('   3. Verify Google Business Profile is connected');
        console.log('   4. Check subscription status');
      } else {
        console.log(`\n✅ System has sent ${recentActivity.length} replies recently.`);
        console.log('   Auto-reply appears to be working!');
      }
    }

    console.log('\n========================================\n');

  } catch (error) {
    console.error('❌ DIAGNOSTIC ERROR:', error);
    console.error(error.stack);
  }

  process.exit(0);
}

// Run diagnostic
diagnoseAutoReply();
