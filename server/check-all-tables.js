/**
 * Check all tables in Supabase and their data
 */

import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

async function checkAllTables() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Supabase credentials not found');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('==========================================');
  console.log('📊 Checking all Supabase tables');
  console.log('==========================================\n');

  // Check coupons table (we know this exists)
  console.log('1️⃣ COUPONS TABLE:');
  console.log('-'.repeat(40));
  const { data: coupons, error: couponsError } = await supabase
    .from('coupons')
    .select('*');

  if (couponsError) {
    console.log('❌ Error:', couponsError.message);
  } else {
    console.log(`✅ Found ${coupons.length} coupon(s)`);
    coupons.forEach(c => console.log(`   - ${c.code}: ${c.discount_value}% off`));
  }

  // Try common table names that might store subscription data
  const tablesToCheck = [
    'users',
    'profiles',
    'accounts',
    'customers',
    'subscriptions',
    'user_subscriptions',
    'billing',
    'payments',
    'orders',
    'automation_settings',
    'user_tokens',
    'locations',
    'gbp_accounts'
  ];

  console.log('\n2️⃣ CHECKING OTHER TABLES:');
  console.log('-'.repeat(40));

  for (const table of tablesToCheck) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(5);

    if (error) {
      if (error.message.includes('not find the table')) {
        // Table doesn't exist, skip silently
      } else {
        console.log(`⚠️ ${table}: ${error.message}`);
      }
    } else {
      console.log(`\n✅ ${table.toUpperCase()} - Found ${data.length} row(s)`);
      if (data.length > 0) {
        console.log('   Columns:', Object.keys(data[0]).join(', '));
        console.log('   Sample data:');
        data.forEach((row, i) => {
          console.log(`   [${i + 1}]`, JSON.stringify(row, null, 2).substring(0, 500));
        });
      }
    }
  }

  // Search for hello.lobaiseo@gmail.com in coupons table (maybe subscription is stored there?)
  console.log('\n3️⃣ SEARCHING FOR hello.lobaiseo@gmail.com:');
  console.log('-'.repeat(40));

  // Check if coupons table has user data
  const { data: couponData } = await supabase
    .from('coupons')
    .select('*');

  console.log('Coupons table structure:', couponData?.[0] ? Object.keys(couponData[0]) : 'empty');

  console.log('\n==========================================\n');
}

checkAllTables().catch(console.error);
