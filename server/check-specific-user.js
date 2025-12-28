import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.azure') });

const userId = 'OBm8qZc0jOWcY53x6rQuX4gKKnQ2';

async function checkUser() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('user_tokens')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('❌ Error:', error);
      return;
    }

    if (!data) {
      console.log('❌ No tokens found for user:', userId);
      console.log('\nThis means the OAuth callback did NOT save tokens.');
      console.log('The GoogleOAuthCallback component never executed.');
      return;
    }

    console.log('✅ Token found for user:', userId);
    console.log('Created:', data.created_at);
    console.log('Expires:', data.expires_at);
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkUser();
