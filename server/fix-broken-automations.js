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

async function fixBrokenAutomations() {
  console.log('='.repeat(80));
  console.log('🔧 FIXING BROKEN AUTOMATION SETTINGS');
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

  console.log(`📊 Found ${allSettings.length} enabled automation records`);
  console.log('');

  let fixedCount = 0;
  let skippedCount = 0;

  for (const setting of allSettings) {
    const locationId = setting.location_id;
    const businessName = setting.settings?.autoPosting?.businessName ||
                        setting.settings?.autoReply?.businessName ||
                        setting.settings?.businessName ||
                        'Unknown';

    // Check if schedule/frequency are missing
    const hasSchedule = setting.settings?.autoPosting?.schedule;
    const hasFrequency = setting.settings?.autoPosting?.frequency;

    if (!hasSchedule || !hasFrequency) {
      console.log(`🔧 FIXING: ${businessName} (${locationId})`);
      console.log(`   Missing: ${!hasSchedule ? 'schedule' : ''} ${!hasFrequency ? 'frequency' : ''}`);

      // Create fixed settings
      const fixedSettings = {
        ...setting.settings,
        autoPosting: {
          ...setting.settings?.autoPosting,
          enabled: true,
          schedule: hasSchedule || '09:00', // Default to 9:00 AM
          frequency: hasFrequency || 'daily', // Default to daily
          businessName: setting.settings?.autoPosting?.businessName ||
                       setting.settings?.businessName ||
                       businessName,
          category: setting.settings?.autoPosting?.category ||
                   setting.settings?.category ||
                   'business',
          keywords: setting.settings?.autoPosting?.keywords ||
                   setting.settings?.keywords ||
                   'quality service, customer satisfaction',
          timezone: setting.settings?.autoPosting?.timezone || 'Asia/Kolkata',
          userId: setting.user_id
        }
      };

      // Also fix autoReply if it exists
      if (setting.auto_reply_enabled) {
        fixedSettings.autoReply = {
          ...setting.settings?.autoReply,
          enabled: true,
          businessName: setting.settings?.autoReply?.businessName ||
                       setting.settings?.businessName ||
                       businessName,
          category: setting.settings?.autoReply?.category ||
                   setting.settings?.category ||
                   'business',
          keywords: setting.settings?.autoReply?.keywords ||
                   setting.settings?.keywords ||
                   'quality service, customer satisfaction',
          replyToAll: true,
          replyToPositive: true,
          replyToNegative: true,
          replyToNeutral: true,
          userId: setting.user_id
        };
      }

      // Update in database
      const { error: updateError } = await supabase
        .from('automation_settings')
        .update({
          settings: fixedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('location_id', locationId)
        .eq('user_id', setting.user_id);

      if (updateError) {
        console.error(`   ❌ Failed to update: ${updateError.message}`);
      } else {
        console.log(`   ✅ Fixed! Set schedule: ${fixedSettings.autoPosting.schedule}, frequency: ${fixedSettings.autoPosting.frequency}`);
        fixedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('✅ DONE!');
  console.log(`   Fixed: ${fixedCount} locations`);
  console.log(`   Skipped (already OK): ${skippedCount} locations`);
  console.log('');
  console.log('🔄 Next step: Reload automations using:');
  console.log('   curl -X POST http://localhost:5000/api/automation/debug/reload-automations');
  console.log('='.repeat(80));
}

fixBrokenAutomations().catch(console.error);
