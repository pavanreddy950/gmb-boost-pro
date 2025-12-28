import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function clearUserTokens() {
  const userId = 'QlJvlBBTEPSV4tb2rsYsDaxdSgd2'; // hello.lobaiseo@gmail.com

  console.log('========================================');
  console.log('🗑️  CLEARING OLD TOKENS');
  console.log('========================================');
  console.log(`User ID: ${userId}`);
  console.log('');

  try {
    // Delete from user_tokens table
    const { data, error } = await supabase
      .from('user_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error deleting tokens:', error);
    } else {
      console.log('✅ Successfully deleted old tokens from Supabase');
    }

    console.log('');
    console.log('========================================');
    console.log('✨ NEXT STEPS:');
    console.log('========================================');
    console.log('1. Go to https://www.app.lobaiseo.com/dashboard/settings');
    console.log('2. Click on "Connections" tab');
    console.log('3. Click "Connect Google Business Profile"');
    console.log('4. Complete the OAuth flow');
    console.log('5. Fresh tokens will be saved!');
    console.log('========================================');

  } catch (err) {
    console.error('❌ Unexpected error:', err);
  }
}

clearUserTokens();
