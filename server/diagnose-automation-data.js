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

async function diagnose() {
  console.log('='.repeat(80));
  console.log('📊 AUTOMATION DATABASE DIAGNOSTIC');
  console.log('='.repeat(80));
  console.log('');

  // 1. Check automation_settings table
  console.log('📋 Checking automation_settings table...');
  const { data: automationSettings, error: autoError } = await supabase
    .from('automation_settings')
    .select('*')
    .order('updated_at', { ascending: false });

  if (autoError) {
    console.error('❌ Error fetching automation_settings:', autoError.message);
  } else {
    console.log(`✅ Found ${automationSettings.length} automation_settings records`);
    console.log('');

    console.log('📝 AUTOMATION SETTINGS BREAKDOWN:');
    console.log('-'.repeat(80));

    const enabledCount = automationSettings.filter(s => s.enabled).length;
    const autoReplyCount = automationSettings.filter(s => s.auto_reply_enabled).length;

    console.log(`   Total records: ${automationSettings.length}`);
    console.log(`   Auto-posting enabled: ${enabledCount}`);
    console.log(`   Auto-reply enabled: ${autoReplyCount}`);
    console.log('');

    // Show details of each automation
    console.log('📍 LOCATION DETAILS:');
    console.log('-'.repeat(80));
    automationSettings.forEach((setting, index) => {
      const businessName = setting.settings?.autoPosting?.businessName ||
                          setting.settings?.autoReply?.businessName ||
                          setting.settings?.businessName ||
                          'Unknown';

      console.log(`\n${index + 1}. ${businessName}`);
      console.log(`   Location ID: ${setting.location_id}`);
      console.log(`   User ID: ${setting.user_id}`);
      console.log(`   Auto-posting enabled: ${setting.enabled ? '✅' : '❌'}`);
      console.log(`   Auto-reply enabled: ${setting.auto_reply_enabled ? '✅' : '❌'}`);
      console.log(`   Last updated: ${new Date(setting.updated_at).toLocaleString()}`);

      if (setting.settings?.autoPosting) {
        console.log(`   Schedule: ${setting.settings.autoPosting.schedule || 'Not set'}`);
        console.log(`   Frequency: ${setting.settings.autoPosting.frequency || 'Not set'}`);
        console.log(`   Last run: ${setting.settings.autoPosting.lastRun || 'Never'}`);
      }
    });
  }

  console.log('');
  console.log('='.repeat(80));

  // 2. Check for any other tables that might contain location data
  console.log('');
  console.log('🔍 Checking for other location-related tables...');
  console.log('');

  // Check google_tokens table
  console.log('📋 Checking google_tokens table...');
  const { data: tokens, error: tokensError } = await supabase
    .from('google_tokens')
    .select('user_id, created_at, updated_at')
    .order('updated_at', { ascending: false });

  if (tokensError) {
    console.error('❌ Error fetching google_tokens:', tokensError.message);
  } else {
    console.log(`✅ Found ${tokens.length} google_tokens records`);
    console.log('');
    console.log('👤 USERS WITH GOOGLE TOKENS:');
    console.log('-'.repeat(80));
    tokens.forEach((token, index) => {
      console.log(`${index + 1}. User ID: ${token.user_id}`);
      console.log(`   Created: ${new Date(token.created_at).toLocaleString()}`);
      console.log(`   Updated: ${new Date(token.updated_at).toLocaleString()}`);
      console.log('');
    });
  }

  console.log('='.repeat(80));
  console.log('');
  console.log('🔍 DIAGNOSIS SUMMARY:');
  console.log('-'.repeat(80));
  console.log('');
  console.log('❓ KEY QUESTIONS TO INVESTIGATE:');
  console.log('');
  console.log('1. How many locations does each user actually have in Google Business Profile?');
  console.log('   (Compare with automation_settings count)');
  console.log('');
  console.log('2. Are there NEW locations that were added recently without automation?');
  console.log('   (Check if latest updated_at matches when locations were added)');
  console.log('');
  console.log('3. Are users manually enabling automation for new locations?');
  console.log('   (If not, we need to auto-enable it OR show a clear prompt)');
  console.log('');
  console.log('='.repeat(80));
  console.log('');
  console.log('✅ DIAGNOSTIC COMPLETE');
  console.log('');
}

diagnose().catch(console.error);
