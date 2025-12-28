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

async function checkDuplicates() {
  console.log('='.repeat(80));
  console.log('🔍 CHECKING FOR DUPLICATE LOCATION ENTRIES');
  console.log('='.repeat(80));
  console.log('');

  // Get all automation settings
  const { data: allSettings, error } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('enabled', true)
    .order('location_id');

  if (error) {
    console.error('❌ Error fetching automation_settings:', error.message);
    process.exit(1);
  }

  console.log(`📊 Total enabled records: ${allSettings.length}`);
  console.log('');

  // Group by location_id
  const byLocation = {};
  for (const setting of allSettings) {
    const locationId = setting.location_id;
    if (!byLocation[locationId]) {
      byLocation[locationId] = [];
    }
    byLocation[locationId].push(setting);
  }

  // Find duplicates
  const duplicates = Object.entries(byLocation).filter(([_, settings]) => settings.length > 1);
  const uniques = Object.entries(byLocation).filter(([_, settings]) => settings.length === 1);

  console.log(`📍 Unique locations: ${uniques.length}`);
  console.log(`🔄 Duplicate locations: ${duplicates.length}`);
  console.log('');

  if (duplicates.length > 0) {
    console.log('🔄 DUPLICATE ENTRIES:');
    console.log('-'.repeat(80));
    for (const [locationId, settings] of duplicates) {
      const businessName = settings[0].settings?.autoPosting?.businessName ||
                          settings[0].settings?.businessName ||
                          'Unknown';
      console.log(`\n📍 ${businessName} (${locationId})`);
      console.log(`   Found ${settings.length} entries:`);

      for (let i = 0; i < settings.length; i++) {
        const s = settings[i];
        console.log(`\n   Entry ${i + 1}:`);
        console.log(`      User ID: ${s.user_id}`);
        console.log(`      Updated: ${new Date(s.updated_at).toLocaleString()}`);
        console.log(`      Schedule: ${s.settings?.autoPosting?.schedule || 'Not set'}`);
        console.log(`      Frequency: ${s.settings?.autoPosting?.frequency || 'Not set'}`);
        console.log(`      Last run: ${s.settings?.autoPosting?.lastRun || 'Never'}`);
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('');
    console.log('💡 RECOMMENDED ACTION:');
    console.log('   The automation scheduler loads settings by location_id ONLY.');
    console.log('   When there are multiple entries for the same location_id with different user_ids,');
    console.log('   only ONE will be loaded (likely the first one returned by the query).');
    console.log('');
    console.log('   You should:');
    console.log('   1. Keep the entry with the CORRECT user_id (real user, not "default")');
    console.log('   2. Keep the entry with the most recent updated_at');
    console.log('   3. Delete the outdated/duplicate entries');
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ ANALYSIS COMPLETE');
  console.log(`   Total records: ${allSettings.length}`);
  console.log(`   Unique locations: ${uniques.length}`);
  console.log(`   Duplicate entries to clean: ${duplicates.length > 0 ? (allSettings.length - uniques.length) : 0}`);
  console.log('='.repeat(80));
}

checkDuplicates().catch(console.error);
