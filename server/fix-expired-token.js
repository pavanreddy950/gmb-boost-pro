import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseTokenStorage from './services/supabaseTokenStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.render or .env.local
dotenv.config({ path: path.join(__dirname, '.env.render') });
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '.env.local') });
}

// IMPORTANT: Replace with your actual Firebase user ID
// To get your user ID: Check the browser console logs when logged in,
// it should show "Auth state changed: User: [email]" with a user ID
const userId = 'g9nPJnKnjrgScYUVc8Xo1AFRDsu1'; // meenakarjale73@gmail.com

async function fixExpiredToken() {
  try {
    console.log('🔧 FIXING EXPIRED/REVOKED GOOGLE TOKEN');
    console.log('==========================================');
    console.log(`👤 User ID: ${userId}`);
    console.log('');

    // Initialize the token storage
    await supabaseTokenStorage.initialize();

    // Check current token status
    console.log('🔍 Checking current token status...');
    const currentToken = await supabaseTokenStorage.getUserToken(userId);

    if (!currentToken) {
      console.log('✅ No token found - user is already disconnected');
      console.log('');
      console.log('📋 Next steps:');
      console.log('1. Go to https://www.app.lobaiseo.com');
      console.log('2. Navigate to Settings > Connections');
      console.log('3. Click "Connect Google Business Profile"');
      console.log('4. Complete the OAuth flow to get fresh tokens');
      return;
    }

    console.log('⚠️ Found existing token:');
    console.log(`   - Has access token: ${!!currentToken.access_token}`);
    console.log(`   - Has refresh token: ${!!currentToken.refresh_token}`);
    if (currentToken.expiry_date) {
      const expiryDate = new Date(currentToken.expiry_date);
      const isExpired = Date.now() > currentToken.expiry_date;
      console.log(`   - Expiry: ${expiryDate.toISOString()}`);
      console.log(`   - Status: ${isExpired ? '❌ EXPIRED' : '✅ Valid'}`);
    }
    console.log('');

    // Delete the token
    console.log('🗑️ Deleting expired/revoked token...');
    const deleted = await supabaseTokenStorage.removeUserToken(userId);

    if (deleted) {
      console.log('✅ Token deleted successfully!');
      console.log('');
      console.log('📋 Next steps:');
      console.log('1. Go to https://www.app.lobaiseo.com');
      console.log('2. Navigate to Settings > Connections');
      console.log('3. Click "Connect Google Business Profile"');
      console.log('4. Complete the OAuth flow to get fresh tokens');
      console.log('');
      console.log('🔒 This will grant fresh tokens that will work for:');
      console.log('   - Posting to Google Business Profile');
      console.log('   - Managing reviews');
      console.log('   - Fetching location data');
      console.log('   - All automated features');
    } else {
      console.error('❌ Failed to delete token');
      console.log('');
      console.log('💡 Manual fix:');
      console.log('1. Go to Supabase dashboard');
      console.log('2. Navigate to Table Editor > user_tokens');
      console.log(`3. Delete the row where user_id = '${userId}'`);
      console.log('4. Then reconnect via the app');
    }

    console.log('');
    console.log('==========================================');

  } catch (error) {
    console.error('❌ Error:', error);
    console.log('');
    console.log('💡 Troubleshooting:');
    console.log('1. Make sure .env.render or .env.local has correct Supabase credentials');
    console.log('2. Check that SUPABASE_URL and SUPABASE_SERVICE_KEY are set');
    console.log('3. Verify the user ID is correct');
  }
}

fixExpiredToken();
