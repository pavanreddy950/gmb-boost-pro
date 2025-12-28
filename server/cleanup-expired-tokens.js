import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, '.env.azure') });

async function cleanupExpiredTokens() {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    console.log('🔍 Scanning for expired tokens...\n');

    // Fetch all tokens
    const { data: allTokens, error: fetchError } = await supabase
      .from('user_tokens')
      .select('user_id, expires_at, created_at')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('❌ Error fetching tokens:', fetchError);
      return;
    }

    if (!allTokens || allTokens.length === 0) {
      console.log('✅ No tokens found in database');
      return;
    }

    // Identify expired tokens
    const now = new Date();
    const expiredTokens = [];
    const validTokens = [];

    allTokens.forEach(token => {
      const expiresAt = new Date(token.expires_at);
      if (expiresAt < now) {
        expiredTokens.push(token);
      } else {
        validTokens.push(token);
      }
    });

    console.log(`📊 Token Summary:`);
    console.log(`   Total tokens: ${allTokens.length}`);
    console.log(`   Valid tokens: ${validTokens.length}`);
    console.log(`   Expired tokens: ${expiredTokens.length}\n`);

    if (expiredTokens.length === 0) {
      console.log('✅ No expired tokens to clean up!');
      return;
    }

    console.log(`🗑️ Deleting ${expiredTokens.length} expired token(s)...\n`);

    // Delete expired tokens one by one and show progress
    let deletedCount = 0;
    let failedCount = 0;

    for (const token of expiredTokens) {
      const { error: deleteError } = await supabase
        .from('user_tokens')
        .delete()
        .eq('user_id', token.user_id);

      if (deleteError) {
        console.error(`❌ Failed to delete token for user: ${token.user_id}`);
        console.error(`   Error: ${deleteError.message}`);
        failedCount++;
      } else {
        console.log(`✅ Deleted: ${token.user_id} (expired: ${token.expires_at})`);
        deletedCount++;
      }
    }

    console.log('\n========================================');
    console.log('📊 Cleanup Summary:');
    console.log(`   Successfully deleted: ${deletedCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log(`   Remaining valid tokens: ${validTokens.length}`);
    console.log('========================================\n');

    if (validTokens.length > 0) {
      console.log('✅ Valid tokens remaining:');
      validTokens.forEach((token, index) => {
        const expiresAt = new Date(token.expires_at);
        const minutesLeft = Math.floor((expiresAt - now) / 1000 / 60);
        console.log(`   ${index + 1}. ${token.user_id} (${minutesLeft} min left)`);
      });
    }

    console.log('\n💡 Users with deleted tokens will need to reconnect:');
    console.log('   Settings → Connections → Connect Google Business Profile');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

cleanupExpiredTokens();
