import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.azure') });

const userId = 'OBm8qZc0jOWcY53x6rQuX4gKKnQ2'; // scalepointstrategy@gmail.com

async function deleteUserToken() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    console.log(`🗑️ Deleting expired token for user: ${userId}`);

    const { data, error } = await supabase
      .from('user_tokens')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error:', error);
      return;
    }

    console.log('✅ Token deleted successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to www.app.lobaiseo.com');
    console.log('2. Click "Connect Google Business Profile"');
    console.log('3. Complete OAuth to get fresh tokens');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

deleteUserToken();
