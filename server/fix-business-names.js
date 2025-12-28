import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixBusinessNames(dryRun = true) {
  console.log('='.repeat(80));
  console.log(`🔧 FIXING BUSINESS NAMES IN AUTOMATION SETTINGS${dryRun ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(80));
  console.log('');

  // Get all automation settings
  const { data: allSettings, error } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('enabled', true);

  if (error) {
    console.error('❌ Error fetching automation_settings:', error.message);
    process.exit(1);
  }

  console.log(`📊 Total enabled records: ${allSettings.length}`);
  console.log('');

  let fixedCount = 0;
  const toUpdate = [];

  for (const setting of allSettings) {
    const locationId = setting.location_id;
    const userId = setting.user_id;

    // Get business name from autoPosting if available
    const autoPostingName = setting.settings?.autoPosting?.businessName;
    const autoReplyName = setting.settings?.autoReply?.businessName;

    // Check if either is "Current Location" or "Business"
    const needsFix =
      autoPostingName === 'Current Location' ||
      autoPostingName === 'Business' ||
      autoReplyName === 'Current Location' ||
      autoReplyName === 'Business' ||
      !autoPostingName ||
      !autoReplyName;

    if (needsFix) {
      // Try to find a good business name
      let goodName = null;

      // Priority 1: Use autoPosting name if it's not generic
      if (autoPostingName &&
          autoPostingName !== 'Current Location' &&
          autoPostingName !== 'Business' &&
          autoPostingName !== 'our business') {
        goodName = autoPostingName;
      }

      // Priority 2: Use autoReply name if it's not generic
      if (!goodName && autoReplyName &&
          autoReplyName !== 'Current Location' &&
          autoReplyName !== 'Business' &&
          autoReplyName !== 'our business') {
        goodName = autoReplyName;
      }

      // If we found a good name, use it to fix both
      if (goodName) {
        console.log(`\n🔧 FIXING: ${goodName} (${locationId})`);
        console.log(`   Before:`);
        console.log(`      autoPosting.businessName: ${autoPostingName || 'NOT SET'}`);
        console.log(`      autoReply.businessName: ${autoReplyName || 'NOT SET'}`);
        console.log(`   After:`);
        console.log(`      Both will be: ${goodName}`);

        // Update settings
        const updatedSettings = {
          ...setting.settings,
          autoPosting: {
            ...setting.settings?.autoPosting,
            businessName: goodName
          }
        };

        if (setting.settings?.autoReply) {
          updatedSettings.autoReply = {
            ...setting.settings.autoReply,
            businessName: goodName
          };
        }

        toUpdate.push({
          location_id: locationId,
          user_id: userId,
          settings: updatedSettings
        });

        fixedCount++;
      } else {
        console.log(`\n⚠️  SKIPPING: Location ${locationId} - No good business name found`);
        console.log(`   autoPosting.businessName: ${autoPostingName || 'NOT SET'}`);
        console.log(`   autoReply.businessName: ${autoReplyName || 'NOT SET'}`);
        console.log(`   Manual fix may be needed`);
      }
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total records: ${allSettings.length}`);
  console.log(`   To fix: ${fixedCount}`);
  console.log('');

  if (!dryRun && toUpdate.length > 0) {
    console.log('🔄 UPDATING DATABASE...');

    for (const update of toUpdate) {
      const { error: updateError } = await supabase
        .from('automation_settings')
        .update({
          settings: update.settings,
          updated_at: new Date().toISOString()
        })
        .eq('location_id', update.location_id)
        .eq('user_id', update.user_id);

      if (updateError) {
        console.error(`   ❌ Failed to update ${update.location_id}:`, updateError.message);
      } else {
        const name = update.settings.autoPosting?.businessName || 'Unknown';
        console.log(`   ✅ Updated ${name} (${update.location_id})`);
      }
    }

    console.log('');
    console.log('✅ DATABASE UPDATE COMPLETE!');
    console.log('');
    console.log('🔄 Next step: Reload automations using:');
    console.log('   curl -X POST http://localhost:5000/api/automation/debug/reload-automations');
  } else if (dryRun) {
    console.log('ℹ️  DRY RUN MODE - No changes made to database');
    console.log('');
    console.log('To actually fix business names, run:');
    console.log('   node fix-business-names.js --update');
  }

  console.log('='.repeat(80));
}

// Check for --update flag
const shouldUpdate = process.argv.includes('--update');
fixBusinessNames(!shouldUpdate).catch(console.error);
