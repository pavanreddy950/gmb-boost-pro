import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

console.log('========================================');
console.log('🔍 SENDGRID API KEY VERIFICATION');
console.log('========================================\n');

const apiKey = process.env.SENDGRID_API_KEY;

console.log('API Key from .env file:');
console.log('  Full Key:', apiKey || 'NOT FOUND');
console.log('  Length:', apiKey ? apiKey.length : 0);
console.log('  First 20 chars:', apiKey ? apiKey.substring(0, 20) : 'N/A');
console.log('  Last 20 chars:', apiKey ? apiKey.substring(apiKey.length - 20) : 'N/A');
console.log('');

// Check for common issues
const issues = [];

if (!apiKey) {
  issues.push('❌ API key is missing from .env file');
} else {
  if (!apiKey.startsWith('SG.')) {
    issues.push('❌ API key does not start with "SG." - invalid format');
  }

  if (apiKey.length < 60) {
    issues.push(`⚠️ API key seems too short (${apiKey.length} chars) - should be 69+ characters`);
  }

  if (apiKey.includes(' ')) {
    issues.push('❌ API key contains spaces - might be truncated or incorrectly copied');
  }

  if (apiKey.includes('\n') || apiKey.includes('\r')) {
    issues.push('❌ API key contains newline characters - formatting issue');
  }

  // Check if key was recently revoked or disabled
  if (apiKey === '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') {
    issues.push('⚠️ This is the same key that just failed - it may have been revoked in SendGrid dashboard');
  }
}

if (issues.length > 0) {
  console.log('❌ ISSUES FOUND:\n');
  issues.forEach(issue => console.log(`   ${issue}`));
  console.log('');
} else {
  console.log('✅ API key format looks correct\n');
}

console.log('========================================');
console.log('🔧 TROUBLESHOOTING STEPS');
console.log('========================================\n');

console.log('1. Check SendGrid Dashboard:');
console.log('   → Go to: https://app.sendgrid.com/settings/api_keys');
console.log('   → Verify this key still exists and is not "Revoked"');
console.log('   → Check the "Action" column for any warnings');
console.log('');

console.log('2. Check API Key Permissions:');
console.log('   → The key must have "Mail Send" permission enabled');
console.log('   → Recommended: Use "Full Access" for testing');
console.log('');

console.log('3. Check SendGrid Account Status:');
console.log('   → Go to: https://app.sendgrid.com/account/details');
console.log('   → Verify account is active (not suspended)');
console.log('   → Check if billing is up to date');
console.log('');

console.log('4. Common Reasons for "Unauthorized" Error:');
console.log('   ❌ API key was deleted or revoked in dashboard');
console.log('   ❌ API key permissions were changed (removed Mail Send)');
console.log('   ❌ SendGrid account suspended (payment/compliance issues)');
console.log('   ❌ API key was copied incorrectly (missing characters)');
console.log('   ❌ Using wrong SendGrid account (different account than where key was created)');
console.log('');

console.log('5. How to Fix:');
console.log('   ✅ Delete the old API key from SendGrid dashboard');
console.log('   ✅ Create a NEW API key with Full Access');
console.log('   ✅ Copy the ENTIRE key (including all dots and dashes)');
console.log('   ✅ Update server/.env file: SENDGRID_API_KEY=SG.your_new_key_here');
console.log('   ✅ Restart the backend server');
console.log('   ✅ Test again: node server/test-send-email-direct.js');
console.log('');

console.log('========================================');
console.log('📋 CURRENT CONFIGURATION');
console.log('========================================\n');

console.log('From Email:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
console.log('From Name:', process.env.SENDGRID_FROM_NAME || 'NOT SET');
console.log('');

console.log('⚠️ IMPORTANT: Make sure "support@lobaiseo.com" is verified in SendGrid!');
console.log('   → Go to: https://app.sendgrid.com/settings/sender_auth/senders');
console.log('   → Verify that support@lobaiseo.com is listed and "Verified"');
console.log('   → If not verified, SendGrid may reject emails from this address');
console.log('');

console.log('========================================');
