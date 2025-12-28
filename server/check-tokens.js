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

async function checkTokens() {
  const locationId = '9279339212510395186'; // Hotel Orchid Resorts

  console.log('='.repeat(80));
  console.log('🔍 CHECKING HOTEL ORCHID RESORTS');
  console.log('='.repeat(80));
  console.log('');

  // Get automation settings
  const { data: settings, error: settingsError } = await supabase
    .from('automation_settings')
    .select('*')
    .eq('location_id', locationId);

  if (settingsError) {
    console.error('❌ Error fetching automation settings:', settingsError.message);
    return;
  }

  console.log(`📊 Found ${settings.length} automation_settings record(s)`);
  console.log('');

  for (const setting of settings) {
    console.log('📍 AUTOMATION SETTING:');
    console.log(`   User ID: ${setting.user_id}`);
    console.log(`   Location ID: ${setting.location_id}`);
    console.log(`   Enabled: ${setting.enabled}`);
    console.log(`   Auto-reply enabled: ${setting.auto_reply_enabled}`);
    console.log(`   Last updated: ${new Date(setting.updated_at).toLocaleString()}`);
    console.log('');
    console.log('   Auto-Posting Config:');
    console.log(`      Schedule: ${setting.settings?.autoPosting?.schedule || 'NOT SET'}`);
    console.log(`      Frequency: ${setting.settings?.autoPosting?.frequency || 'NOT SET'}`);
    console.log(`      Last run: ${setting.settings?.autoPosting?.lastRun || 'Never'}`);
    console.log(`      Business name: ${setting.settings?.autoPosting?.businessName || 'NOT SET'}`);
    console.log('');

    // Check if user has valid token
    console.log('🔑 CHECKING USER TOKEN:');
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', setting.user_id)
      .single();

    if (tokenError) {
      console.error(`   ❌ No token found for user ${setting.user_id}`);
      console.error(`   Error: ${tokenError.message}`);
    } else {
      const expiryDate = new Date(tokenData.expiry_date);
      const now = new Date();
      const isExpired = expiryDate < now;

      console.log(`   ✅ Token found`);
      console.log(`   Expires: ${expiryDate.toLocaleString()}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
      console.log(`   Time until expiry: ${Math.round((expiryDate - now) / 1000 / 60)} minutes`);
    }
    console.log('');

    // Check subscription status
    console.log('💳 CHECKING SUBSCRIPTION:');
    const { data: subscriptions, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', setting.user_id);

    if (subError) {
      console.error(`   ❌ Error checking subscription: ${subError.message}`);
    } else if (subscriptions.length === 0) {
      console.log(`   ⚠️  No subscription found for user ${setting.user_id}`);
    } else {
      for (const sub of subscriptions) {
        console.log(`   Subscription ID: ${sub.id}`);
        console.log(`   Status: ${sub.status}`);
        console.log(`   Type: ${sub.subscription_type}`);
        console.log(`   Trial: ${sub.is_trial ? 'Yes' : 'No'}`);
        if (sub.trial_end_date) {
          const trialEnd = new Date(sub.trial_end_date);
          const trialExpired = trialEnd < new Date();
          console.log(`   Trial ends: ${trialEnd.toLocaleString()} ${trialExpired ? '(EXPIRED)' : '(Active)'}`);
        }
        if (sub.current_period_end) {
          const periodEnd = new Date(sub.current_period_end);
          console.log(`   Period ends: ${periodEnd.toLocaleString()}`);
        }
      }
    }
    console.log('');
  }

  console.log('='.repeat(80));
}

checkTokens().catch(console.error);
