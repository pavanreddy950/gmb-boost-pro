/**
 * Deep research on database structure
 * Find ALL tables and their columns
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function deepResearch() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log('🔍 DEEP DATABASE RESEARCH');
  console.log('==========================================\n');

  // Comprehensive list of possible table names
  const allPossibleTables = [
    // User/Auth tables
    'users', 'user', 'profiles', 'accounts', 'customers', 'members',
    // Subscription tables
    'subscriptions', 'subscription', 'user_subscriptions', 'billing', 'plans',
    // Payment tables
    'payments', 'payment_history', 'transactions', 'orders', 'invoices',
    // GBP/Location tables
    'locations', 'location', 'user_locations', 'gbp_accounts', 'gbp_locations',
    'google_accounts', 'business_profiles', 'gmb_locations',
    // Automation tables
    'automation_settings', 'automations', 'auto_post_settings', 'scheduled_posts',
    'posts', 'reviews', 'auto_replies',
    // Token tables
    'user_tokens', 'tokens', 'oauth_tokens', 'google_tokens',
    // Coupon tables
    'coupons', 'coupon_usage', 'discounts',
    // Mapping tables
    'user_gbp_mapping', 'user_location_mapping',
    // Other
    'settings', 'config', 'logs', 'activity_logs'
  ];

  const existingTables = [];

  console.log('📋 SCANNING FOR ALL TABLES...\n');

  for (const table of allPossibleTables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (!error) {
      existingTables.push(table);
    }
  }

  console.log(`✅ Found ${existingTables.length} table(s): ${existingTables.join(', ')}\n`);

  // Now get detailed info on each existing table
  for (const table of existingTables) {
    console.log('==========================================');
    console.log(`📊 TABLE: ${table.toUpperCase()}`);
    console.log('==========================================');

    const { data, error } = await supabase
      .from(table)
      .select('*');

    if (error) {
      console.log('Error:', error.message);
      continue;
    }

    // Get columns from first row
    if (data && data.length > 0) {
      const columns = Object.keys(data[0]);
      console.log(`\n📝 COLUMNS (${columns.length}):`);
      columns.forEach(col => {
        const sampleValue = data[0][col];
        const valueType = typeof sampleValue;
        const sampleStr = sampleValue === null ? 'null' :
                          typeof sampleValue === 'object' ? JSON.stringify(sampleValue).substring(0, 50) :
                          String(sampleValue).substring(0, 50);
        console.log(`   - ${col} (${valueType}): ${sampleStr}`);
      });

      console.log(`\n📈 ROW COUNT: ${data.length}`);

      console.log('\n📄 ALL DATA:');
      data.forEach((row, i) => {
        console.log(`\n--- Row ${i + 1} ---`);
        Object.keys(row).forEach(key => {
          const val = row[key];
          if (val !== null && val !== undefined && val !== '') {
            const displayVal = typeof val === 'string' && val.length > 100
              ? val.substring(0, 100) + '...'
              : val;
            console.log(`   ${key}: ${displayVal}`);
          }
        });
      });
    } else {
      console.log('\n⚠️ Table is empty');

      // Try to get column info from metadata
      const { data: metaData, error: metaError } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      console.log('(Cannot determine columns for empty table)');
    }

    console.log('\n');
  }

  console.log('==========================================');
  console.log('🔍 RESEARCH COMPLETE');
  console.log('==========================================\n');

  console.log('📋 SUMMARY:');
  console.log(`   Tables found: ${existingTables.join(', ')}`);
  console.log('\n💡 RECOMMENDATIONS:');
  console.log('   - Primary key should be: gmail_id');
  console.log('   - All services should use gmail_id to lookup users');
  console.log('   - Subscription data is in users table');
}

deepResearch().catch(console.error);
