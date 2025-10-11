/**
 * Verify Supabase Data
 * Check what data is stored in Supabase
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseConfig from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env.local');
dotenv.config({ path: envPath });

async function verifyData() {
  console.log('🔍 Verifying Supabase Data...\n');

  try {
    const client = await supabaseConfig.ensureInitialized();

    // Check user_tokens
    const { data: tokens, error: tokensError } = await client
      .from('user_tokens')
      .select('user_id, expires_at, created_at');

    console.log('📊 USER TOKENS:');
    console.log(`   Total: ${tokens?.length || 0}`);
    if (tokens && tokens.length > 0) {
      tokens.forEach(t => console.log(`   - ${t.user_id} (expires: ${t.expires_at})`));
    }
    console.log('');

    // Check subscriptions
    const { data: subs } = await client
      .from('subscriptions')
      .select('id, email, status, plan_id, profile_count');

    console.log('📊 SUBSCRIPTIONS:');
    console.log(`   Total: ${subs?.length || 0}`);
    if (subs && subs.length > 0) {
      subs.forEach(s => console.log(`   - ${s.email}: ${s.status} (${s.plan_id}) - ${s.profile_count} profiles`));
    }
    console.log('');

    // Check payment_history
    const { data: payments } = await client
      .from('payment_history')
      .select('id, amount, currency, status');

    console.log('📊 PAYMENT HISTORY:');
    console.log(`   Total: ${payments?.length || 0}`);
    console.log('');

    // Check automation_settings
    const { data: automations } = await client
      .from('automation_settings')
      .select('user_id, location_id, enabled, auto_reply_enabled');

    console.log('📊 AUTOMATION SETTINGS:');
    console.log(`   Total: ${automations?.length || 0}`);
    if (automations && automations.length > 0) {
      automations.forEach(a => console.log(`   - Location ${a.location_id}: ${a.enabled ? '✅ Enabled' : '❌ Disabled'}`));
    }
    console.log('');

    // Check qr_codes
    const { data: qrs } = await client
      .from('qr_codes')
      .select('code, location_id, scans');

    console.log('📊 QR CODES:');
    console.log(`   Total: ${qrs?.length || 0}`);
    console.log('');

    // Check coupons
    const { data: coupons } = await client
      .from('coupons')
      .select('code, discount_type, discount_value, is_active');

    console.log('📊 COUPONS:');
    console.log(`   Total: ${coupons?.length || 0}`);
    console.log('');

    console.log('═══════════════════════════════════════════');
    console.log('✅ Data verification complete!');
    console.log('═══════════════════════════════════════════\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error verifying data:', error);
    process.exit(1);
  }
}

verifyData();




