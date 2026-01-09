/**
 * List all tables in Supabase database
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function listTables() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log('📊 Listing all tables in Supabase');
  console.log('==========================================\n');

  // Query information_schema to get all tables
  const { data, error } = await supabase
    .from('information_schema.tables')
    .select('table_name')
    .eq('table_schema', 'public');

  if (error) {
    console.log('Cannot query information_schema directly. Trying known table names...\n');

    // Try to query known tables
    const knownTables = [
      'subscriptions',
      'payment_history',
      'user_gbp_mapping',
      'automation_settings',
      'user_tokens',
      'coupons',
      'coupon_usage',
      'scheduled_posts'
    ];

    for (const table of knownTables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);

      if (error) {
        if (error.message.includes('not find the table')) {
          console.log(`❌ ${table} - NOT FOUND`);
        } else {
          console.log(`⚠️ ${table} - ERROR: ${error.message}`);
        }
      } else {
        console.log(`✅ ${table} - EXISTS (${data.length} sample rows)`);
      }
    }
  } else {
    console.log('Found tables:', data);
  }

  console.log('\n==========================================\n');
}

listTables().catch(console.error);
