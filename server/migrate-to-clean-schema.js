import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('SUPABASE_URL:', supabaseUrl ? 'Found' : 'Missing');
  console.error('SUPABASE_SERVICE_KEY:', supabaseKey ? 'Found' : 'Missing');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Migration Script: Clean Schema
 *
 * This script:
 * 1. Applies the new clean schema (2 tables: users, locations)
 * 2. Migrates data from old tables to new tables
 * 3. Organizes everything by Gmail ID
 */

async function runCleanSchemaMigration() {
  try {
    console.log('\n🚀 STARTING CLEAN SCHEMA MIGRATION\n');
    console.log('='.repeat(80));

    // Step 1: Read and apply the clean schema
    console.log('\n1️⃣ APPLYING CLEAN SCHEMA...');
    const schemaPath = path.join(__dirname, 'database', 'CLEAN-SCHEMA.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');

    console.log('   ⚠️  WARNING: This will DROP all existing tables!');
    console.log('   Press Ctrl+C within 5 seconds to cancel...\n');

    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Execute schema (Note: Supabase doesn't allow direct SQL execution via client)
    // You'll need to run this manually in Supabase SQL Editor
    console.log('   📋 Schema SQL prepared. You need to:');
    console.log('   1. Go to Supabase Dashboard > SQL Editor');
    console.log('   2. Copy the contents of: server/database/CLEAN-SCHEMA.sql');
    console.log('   3. Run it in SQL Editor');
    console.log('   4. Come back and run this migration script again\n');

    // Check if new tables exist
    console.log('   🔍 Checking if new tables exist...');
    const { data: usersCheck, error: usersError } = await supabase
      .from('users')
      .select('gmail_id')
      .limit(1);

    if (usersError) {
      console.log('   ❌ New tables not found. Please run the schema SQL first.');
      console.log('\n   📝 INSTRUCTIONS:');
      console.log('   1. Open Supabase Dashboard: https://supabase.com/dashboard');
      console.log('   2. Go to SQL Editor');
      console.log(`   3. Copy & paste: ${schemaPath}`);
      console.log('   4. Click RUN');
      console.log('   5. Run this script again\n');
      process.exit(0);
    }

    console.log('   ✅ New tables exist! Proceeding with migration...\n');

    // Step 2: Migrate data from old tables
    console.log('2️⃣ MIGRATING DATA FROM OLD TABLES...\n');

    // Get all automation settings (old table)
    console.log('   📦 Fetching old automation_settings...');
    const { data: oldSettings, error: oldError } = await supabase
      .from('automation_settings')
      .select('*');

    if (oldError) {
      console.log('   ⚠️  No old automation_settings found (table might not exist)');
    } else {
      console.log(`   ✅ Found ${oldSettings?.length || 0} automation settings\n`);

      // Group by userId and create user + location records
      const userMap = new Map();

      for (const setting of oldSettings || []) {
        const userId = setting.user_id;
        const locationId = setting.location_id;
        const settings = setting.settings || {};

        // Extract user info
        if (!userMap.has(userId)) {
          userMap.set(userId, {
            userId,
            locations: [],
            gmailId: settings.autoPosting?.email || settings.email || `${userId}@firebase.user`
          });
        }

        // Add location to user
        userMap.get(userId).locations.push({
          locationId,
          businessName: settings.autoPosting?.businessName || settings.businessName || 'Unknown Business',
          category: settings.autoPosting?.category || settings.category || 'business',
          keywords: settings.autoPosting?.keywords || settings.keywords || '',
          autopostingEnabled: settings.enabled && settings.autoPosting?.enabled,
          autopostingSchedule: settings.autoPosting?.schedule || '10:00',
          autopostingFrequency: settings.autoPosting?.frequency || 'daily',
          autoreplyEnabled: settings.autoReply?.enabled || settings.autoReplyEnabled || false
        });
      }

      console.log(`   📊 Found ${userMap.size} unique users\n`);

      // Insert users and locations
      let userCount = 0;
      let locationCount = 0;

      for (const [userId, userData] of userMap.entries()) {
        console.log(`   👤 Processing user: ${userData.gmailId}`);

        // Insert user
        const { error: userError } = await supabase
          .from('users')
          .upsert({
            gmail_id: userData.gmailId,
            firebase_uid: userId,
            subscription_status: 'trial',
            trial_start_date: new Date().toISOString(),
            trial_end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(), // 15 days
            is_admin: userData.gmailId === 'scalepointstrategy@gmail.com',
            profile_count: userData.locations.length
          }, {
            onConflict: 'gmail_id'
          });

        if (userError) {
          console.log(`      ❌ Error creating user: ${userError.message}`);
          continue;
        }

        userCount++;
        console.log(`      ✅ User created/updated`);

        // Insert locations
        for (const loc of userData.locations) {
          const { error: locError } = await supabase
            .from('locations')
            .upsert({
              gmail_id: userData.gmailId,
              location_id: loc.locationId,
              business_name: loc.businessName,
              category: loc.category,
              keywords: loc.keywords,
              autoposting_enabled: loc.autopostingEnabled,
              autoposting_schedule: loc.autopostingSchedule,
              autoposting_frequency: loc.autopostingFrequency,
              autoreply_enabled: loc.autoreplyEnabled
            }, {
              onConflict: 'gmail_id,location_id'
            });

          if (locError) {
            console.log(`      ❌ Error creating location ${loc.locationId}: ${locError.message}`);
          } else {
            locationCount++;
            console.log(`      ✅ Location: ${loc.businessName}`);
          }
        }

        console.log('');
      }

      console.log(`\n   ✅ Migration complete!`);
      console.log(`      - Users migrated: ${userCount}`);
      console.log(`      - Locations migrated: ${locationCount}\n`);
    }

    console.log('='.repeat(80));
    console.log('✅ MIGRATION COMPLETE!\n');
    console.log('📝 NEXT STEPS:');
    console.log('   1. Update backend services to use new schema');
    console.log('   2. Test auto-posting with new tables');
    console.log('   3. Delete old tables once confirmed working\n');

  } catch (error) {
    console.error('\n❌ MIGRATION ERROR:', error);
    process.exit(1);
  }

  process.exit(0);
}

runCleanSchemaMigration();
