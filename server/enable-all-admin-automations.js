import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

import supabaseAutomationService from './services/supabaseAutomationService.js';

/**
 * Script to enable auto-posting for ALL locations owned by admin users
 * This fixes the issue where toggles are ON but not saved to Supabase
 */

// Get ALL user IDs from automation settings (we'll enable all of them)
const ADMIN_USER_IDS = [
  'QlJvlBBTEPSV4tb2rsYsDaxdSgd2', // Main admin - hello.lobaiseo@gmail.com
  'DcNiHImcRIZbS91ESAXXXBXszHo1',
  'Dt6nADGTMnNLSHZ0UT2a5vRgoGD2',
  'eqhId9xWsihTrhkh2XdBrOB5d7H3',
  'eWw8jjayQcSKN8uk9GLyNg49lMn2',
  'g9nPJnKnjrgScYUVc8Xo1AFRDsu1',
  'hmJ9lQHiq7VxdZEQvsuRhSZJGze2',
  'JYPCqRxZktSegsr5bUrdnHPUfL82',
  'jzssBuuuFZUknI20kZuyLXCc6ne2',
  'mAjV5g9gmrWk3cKaAUMH0NaDjFH3',
  'neXnWiL2gYfrvgkFGEvfIRb8Kgr1',
  'non8dHhfwfX6YAhXGh5fEFpe9UJ2',
  'OBm8qZc0jOWcY53x6rQuX4gKKnQ2',
  't3dWwSbsHFO8WnBocdem5cpVSfg1',
  'z3BYbz0FhuTBgsmnSyMCEKvRDa42',
  'zP0MaEK8Fngs6WSTrxHc2gXoLul2',
  'zU0xecOCHQRkM4BfL3Vuh1TRMVH3'
];

async function enableAllAdminAutomations() {
  try {
    console.log('🚀 Starting bulk automation enablement for admin users...\n');

    for (const userId of ADMIN_USER_IDS) {
      console.log(`\n========================================`);
      console.log(`Processing user: ${userId}`);
      console.log(`========================================\n`);

      // Get all automation settings for this user
      const settings = await supabaseAutomationService.getAllSettingsForUser(userId);
      console.log(`Found ${settings.length} location(s) for user ${userId}`);

      let enabledCount = 0;
      let alreadyEnabledCount = 0;
      let errorCount = 0;

      for (const setting of settings) {
        const locationId = setting.locationId || setting.location_id;
        const businessName = setting.settings?.autoPosting?.businessName ||
                           setting.settings?.businessName ||
                           'Unknown Business';

        console.log(`\n📍 Processing: ${businessName} (${locationId})`);

        try {
          // Check if autoPosting is already enabled
          if (setting.enabled && setting.settings?.autoPosting?.enabled) {
            console.log(`  ✅ Already enabled - skipping`);
            alreadyEnabledCount++;
            continue;
          }

          // Prepare updated settings with autoPosting enabled
          const updatedSettings = {
            ...setting.settings,
            userId: userId,
            locationId: locationId,
            enabled: true, // Enable automation
            autoReplyEnabled: setting.settings?.autoReply?.enabled || false,
            autoPosting: {
              ...setting.settings?.autoPosting,
              enabled: true, // Enable auto-posting
              schedule: setting.settings?.autoPosting?.schedule || '10:00',
              frequency: setting.settings?.autoPosting?.frequency || 'daily',
              businessName: businessName,
              category: setting.settings?.autoPosting?.category || setting.settings?.category || 'business',
              keywords: setting.settings?.autoPosting?.keywords || setting.settings?.keywords || businessName,
              userId: userId,
              accountId: setting.settings?.autoPosting?.accountId || '106433552101751461082',
              timezone: 'Asia/Kolkata',
              userCustomizedTime: false
            },
            autoReply: {
              ...setting.settings?.autoReply,
              enabled: setting.settings?.autoReply?.enabled || false,
              businessName: businessName,
              category: setting.settings?.autoReply?.category || setting.settings?.category || 'business',
              keywords: setting.settings?.autoReply?.keywords || setting.settings?.keywords || businessName,
              userId: userId,
              accountId: setting.settings?.autoReply?.accountId || '106433552101751461082'
            }
          };

          // Save to Supabase
          await supabaseAutomationService.saveSettings(userId, locationId, updatedSettings);
          console.log(`  ✅ Enabled auto-posting for ${businessName}`);
          enabledCount++;

        } catch (error) {
          console.error(`  ❌ Error enabling ${businessName}:`, error.message);
          errorCount++;
        }
      }

      console.log(`\n========================================`);
      console.log(`Summary for user ${userId}:`);
      console.log(`  - Total locations: ${settings.length}`);
      console.log(`  - Newly enabled: ${enabledCount}`);
      console.log(`  - Already enabled: ${alreadyEnabledCount}`);
      console.log(`  - Errors: ${errorCount}`);
      console.log(`========================================\n`);
    }

    console.log('\n✅ Bulk automation enablement completed!');
    console.log('🔄 Server will reload automations on next restart or within 30 seconds.');

  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the script
console.log('========================================');
console.log('BULK ENABLE ADMIN AUTOMATIONS');
console.log('========================================\n');
console.log('This script will enable auto-posting for ALL locations');
console.log('owned by admin users in Supabase.\n');
console.log('Admin User IDs:');
ADMIN_USER_IDS.forEach(id => console.log(`  - ${id}`));
console.log('\n');

enableAllAdminAutomations();
