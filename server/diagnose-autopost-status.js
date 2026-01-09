import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

import supabaseAutomationService from './services/supabaseAutomationService.js';
import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';
import subscriptionGuard from './services/subscriptionGuard.js';

/**
 * Diagnostic script to find why some profiles show "Auto-post off"
 * This will check:
 * 1. Automation settings in Supabase (enabled flag)
 * 2. Subscription/trial status
 * 3. Token availability
 * 4. Subscription guard validation
 */

// List of all location IDs from the screenshot
const LOCATION_IDS = [
  '9152028977863765725',     // SITARAM GUEST HOUSE - Auto-post off
  '17676898239868064955',    // NK Desert Camp & Resort - Auto-post off
  '143639376938647655',      // Pravara Cottages - Auto-post on
  '4081375756484091282',     // New hope treatment - Auto-post off
  '13105974633901693907',    // Scale Point Strategy - Auto-post on
  '3835561564304183366',     // Jubilation Banquet - Auto-post off
  '12595110707100978856',    // MAANI RESTAURANT - Auto-post off
  '14977377147025961194'     // Kubera Wealth - Auto-post off
];

async function diagnoseLocationStatus(locationId) {
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📍 DIAGNOSING LOCATION: ${locationId}`);
  console.log(`${'='.repeat(80)}`);

  try {
    // 1. Check automation settings in Supabase
    console.log('\n1️⃣ CHECKING AUTOMATION SETTINGS IN SUPABASE...');
    const settings = await supabaseAutomationService.getSettings(null, locationId);

    if (!settings) {
      console.log('   ❌ NO SETTINGS FOUND IN SUPABASE');
      return { locationId, issue: 'NO_SETTINGS_IN_DB', hasAutoPost: false };
    }

    console.log(`   ✅ Settings found for userId: ${settings.userId}`);
    console.log(`   - Root enabled: ${settings.enabled}`);
    console.log(`   - AutoPosting.enabled: ${settings.autoPosting?.enabled}`);
    console.log(`   - AutoReply.enabled: ${settings.autoReply?.enabled || settings.autoReplyEnabled}`);
    console.log(`   - Business Name: ${settings.autoPosting?.businessName || 'NOT SET'}`);
    console.log(`   - Schedule: ${settings.autoPosting?.schedule || 'NOT SET'}`);
    console.log(`   - Frequency: ${settings.autoPosting?.frequency || 'NOT SET'}`);

    const userId = settings.userId;

    // 2. Check subscription/trial status
    console.log('\n2️⃣ CHECKING SUBSCRIPTION/TRIAL STATUS...');
    const subscription = await supabaseSubscriptionService.getSubscriptionByUserId(userId);

    if (!subscription) {
      console.log('   ❌ NO SUBSCRIPTION/TRIAL FOUND');
      return {
        locationId,
        userId,
        issue: 'NO_SUBSCRIPTION',
        hasAutoPost: false,
        settingsEnabled: settings.enabled,
        autoPostingEnabled: settings.autoPosting?.enabled
      };
    }

    console.log(`   ✅ Subscription found`);
    console.log(`   - Status: ${subscription.status}`);
    console.log(`   - Email: ${subscription.email}`);
    console.log(`   - Trial End: ${subscription.trialEndDate || 'N/A'}`);
    console.log(`   - Subscription End: ${subscription.subscriptionEndDate || 'N/A'}`);

    if (subscription.trialEndDate) {
      const trialEnd = new Date(subscription.trialEndDate);
      const now = new Date();
      const daysRemaining = Math.ceil((trialEnd - now) / (1000 * 60 * 60 * 24));
      console.log(`   - Trial Days Remaining: ${daysRemaining}`);
    }

    // 3. Check if user is admin
    console.log('\n3️⃣ CHECKING ADMIN STATUS...');
    const isAdmin = await subscriptionGuard.isAdmin(userId);
    console.log(`   ${isAdmin ? '✅' : '❌'} Admin status: ${isAdmin}`);

    // 4. Check subscription guard validation
    console.log('\n4️⃣ CHECKING SUBSCRIPTION GUARD VALIDATION...');
    const access = await subscriptionGuard.hasValidAccess(userId, null);
    console.log(`   ${access.hasAccess ? '✅' : '❌'} Has access: ${access.hasAccess}`);
    console.log(`   - Status: ${access.status || access.reason}`);
    console.log(`   - Message: ${access.message}`);
    console.log(`   - Days Remaining: ${access.daysRemaining || 'N/A'}`);

    // 5. Final verdict
    console.log('\n5️⃣ FINAL VERDICT:');
    const shouldShowAutoPostOn = (
      settings.enabled === true &&
      settings.autoPosting?.enabled === true &&
      access.hasAccess === true
    );

    console.log(`   Expected Dashboard Status: ${shouldShowAutoPostOn ? '✅ AUTO-POST ON' : '❌ AUTO-POST OFF'}`);

    if (!shouldShowAutoPostOn) {
      console.log('\n   🔍 REASONS WHY AUTO-POST IS OFF:');
      if (!settings.enabled) console.log('      - Root settings.enabled is FALSE');
      if (!settings.autoPosting?.enabled) console.log('      - settings.autoPosting.enabled is FALSE');
      if (!access.hasAccess) console.log(`      - Subscription guard blocked access: ${access.reason}`);
    }

    return {
      locationId,
      userId,
      settingsEnabled: settings.enabled,
      autoPostingEnabled: settings.autoPosting?.enabled,
      hasSubscription: !!subscription,
      subscriptionStatus: subscription?.status,
      hasAccess: access.hasAccess,
      accessReason: access.status || access.reason,
      shouldShowAutoPostOn,
      issue: shouldShowAutoPostOn ? null : 'AUTO_POST_OFF'
    };

  } catch (error) {
    console.error(`   ❌ ERROR:`, error.message);
    return { locationId, issue: 'ERROR', error: error.message, hasAutoPost: false };
  }
}

async function runDiagnostics() {
  console.log('\n');
  console.log('🔍 AUTO-POST STATUS DIAGNOSTIC TOOL');
  console.log('='.repeat(80));
  console.log(`Checking ${LOCATION_IDS.length} locations...\n`);

  const results = [];

  for (const locationId of LOCATION_IDS) {
    const result = await diagnoseLocationStatus(locationId);
    results.push(result);
  }

  // Print summary
  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 SUMMARY REPORT');
  console.log('='.repeat(80));

  const autoPostOn = results.filter(r => r.shouldShowAutoPostOn);
  const autoPostOff = results.filter(r => !r.shouldShowAutoPostOn);

  console.log(`\n✅ AUTO-POST ON: ${autoPostOn.length} locations`);
  autoPostOn.forEach(r => {
    console.log(`   - ${r.locationId} (userId: ${r.userId})`);
  });

  console.log(`\n❌ AUTO-POST OFF: ${autoPostOff.length} locations`);
  autoPostOff.forEach(r => {
    console.log(`   - ${r.locationId} (userId: ${r.userId || 'UNKNOWN'})`);
    console.log(`     Issue: ${r.issue}`);
    console.log(`     Settings enabled: ${r.settingsEnabled}`);
    console.log(`     AutoPosting enabled: ${r.autoPostingEnabled}`);
    console.log(`     Has subscription: ${r.hasSubscription}`);
    console.log(`     Has access: ${r.hasAccess}`);
    console.log(`     Access reason: ${r.accessReason}`);
  });

  console.log('\n');
  process.exit(0);
}

runDiagnostics();
