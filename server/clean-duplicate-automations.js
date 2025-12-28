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

function scoreEntry(entry) {
  let score = 0;

  // Prefer real user_id over "default"
  if (entry.user_id !== 'default') {
    score += 100;
  }

  // Prefer entries that have actually run
  if (entry.settings?.autoPosting?.lastRun && entry.settings.autoPosting.lastRun !== 'Never') {
    score += 50;
    // Bonus for recent runs
    try {
      const lastRun = new Date(entry.settings.autoPosting.lastRun);
      const daysSinceRun = (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceRun < 7) {
        score += 30; // Recent run
      }
    } catch (e) {
      // ignore
    }
  }

  // Prefer more recently updated entries
  try {
    const updated = new Date(entry.updated_at);
    const daysSinceUpdate = (Date.now() - updated.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) {
      score += 20;
    }
  } catch (e) {
    // ignore
  }

  return score;
}

async function cleanDuplicates(dryRun = true) {
  console.log('='.repeat(80));
  console.log(`🧹 CLEANING DUPLICATE AUTOMATION SETTINGS${dryRun ? ' (DRY RUN)' : ''}`);
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
  console.log(`🔄 Locations with duplicates: ${duplicates.length}`);
  console.log('');

  let toDeleteCount = 0;
  const idsToDelete = [];

  if (duplicates.length > 0) {
    console.log('🔄 PROCESSING DUPLICATES:');
    console.log('-'.repeat(80));

    for (const [locationId, settings] of duplicates) {
      const businessName = settings[0].settings?.autoPosting?.businessName ||
                          settings[0].settings?.businessName ||
                          'Unknown';

      console.log(`\n📍 ${businessName} (${locationId})`);
      console.log(`   Found ${settings.length} entries - analyzing...`);

      // Score each entry
      const scored = settings.map(s => ({
        ...s,
        score: scoreEntry(s)
      })).sort((a, b) => b.score - a.score);

      // Keep the highest scored entry
      const toKeep = scored[0];
      const toDelete = scored.slice(1);

      console.log(`\n   ✅ KEEPING:`);
      console.log(`      User ID: ${toKeep.user_id}`);
      console.log(`      Score: ${toKeep.score}`);
      console.log(`      Updated: ${new Date(toKeep.updated_at).toLocaleString()}`);
      console.log(`      Last run: ${toKeep.settings?.autoPosting?.lastRun || 'Never'}`);

      console.log(`\n   🗑️  DELETING ${toDelete.length} duplicate(s):`);
      for (const entry of toDelete) {
        console.log(`      - User ID: ${entry.user_id}, Score: ${entry.score}, Updated: ${new Date(entry.updated_at).toLocaleString()}`);
        idsToDelete.push({ location_id: entry.location_id, user_id: entry.user_id });
        toDeleteCount++;
      }
    }

    console.log('');
    console.log('='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total records: ${allSettings.length}`);
    console.log(`   To keep: ${allSettings.length - toDeleteCount}`);
    console.log(`   To delete: ${toDeleteCount}`);
    console.log('');

    if (!dryRun && idsToDelete.length > 0) {
      console.log('🗑️  DELETING DUPLICATES...');

      for (const { location_id, user_id } of idsToDelete) {
        const { error: deleteError } = await supabase
          .from('automation_settings')
          .delete()
          .eq('location_id', location_id)
          .eq('user_id', user_id);

        if (deleteError) {
          console.error(`   ❌ Failed to delete ${location_id} / ${user_id}:`, deleteError.message);
        } else {
          console.log(`   ✅ Deleted ${location_id} / ${user_id}`);
        }
      }

      console.log('');
      console.log('✅ CLEANUP COMPLETE!');
      console.log('');
      console.log('🔄 Next step: Reload automations using:');
      console.log('   curl -X POST http://localhost:5000/api/automation/debug/reload-automations');
    } else if (dryRun) {
      console.log('ℹ️  DRY RUN MODE - No changes made to database');
      console.log('');
      console.log('To actually delete duplicates, run:');
      console.log('   node clean-duplicate-automations.js --delete');
    }
  } else {
    console.log('✅ No duplicates found!');
  }

  console.log('='.repeat(80));
}

// Check for --delete flag
const shouldDelete = process.argv.includes('--delete');
cleanDuplicates(!shouldDelete).catch(console.error);
