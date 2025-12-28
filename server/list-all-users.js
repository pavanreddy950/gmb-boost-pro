import supabaseTokenStorage from './services/supabaseTokenStorage.js';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.azure') });

async function listAllUsers() {
  try {
    console.log('📋 Fetching all users with tokens...\n');

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('user_tokens')
      .select('user_id, created_at, expires_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    if (!data || data.length === 0) {
      console.log('❌ No users found with tokens');
      return;
    }

    console.log(`✅ Found ${data.length} user(s) with tokens:\n`);

    data.forEach((user, index) => {
      const expiresAt = new Date(user.expires_at);
      const now = new Date();
      const isExpired = expiresAt < now;
      const minutesLeft = Math.floor((expiresAt - now) / 1000 / 60);

      console.log(`${index + 1}. User ID: ${user.user_id}`);
      console.log(`   Created: ${user.created_at}`);
      console.log(`   Expires: ${user.expires_at}`);
      console.log(`   Status: ${isExpired ? '❌ EXPIRED' : `✅ Valid (${minutesLeft} min left)`}\n`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

listAllUsers();
