import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

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
    console.log('⚠️ WARNING: This key was just tested and FAILED with "Unauthorized" error');
    console.log('   This means SendGrid rejected it - likely revoked or has insufficient permissions\n');
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
console.log('🔧 WHY YOUR KEY MIGHT BE DISABLED');
console.log('========================================\n');

console.log('Most Common Reasons (in order of likelihood):\n');

console.log('1. ❌ API Key Permissions Issue (MOST LIKELY)');
console.log('   → When creating the key, did you select "Full Access" or "Restricted Access"?');
console.log('   → If "Restricted", you MUST enable "Mail Send" permission');
console.log('   → Solution: Create a new key with "Full Access" selected\n');

console.log('2. ❌ Sender Email Not Verified');
console.log('   → SendGrid requires "support@lobaiseo.com" to be verified');
console.log('   → If you just created the account, verification might be pending');
console.log('   → Check: https://app.sendgrid.com/settings/sender_auth/senders');
console.log('   → Look for support@lobaiseo.com - should show "Verified" status\n');

console.log('3. ❌ SendGrid Account Suspended');
console.log('   → New accounts sometimes trigger fraud detection');
console.log('   → Check for emails from SendGrid about account review');
console.log('   → Solution: Contact SendGrid support or wait for review\n');

console.log('4. ❌ API Key Was Revoked/Deleted');
console.log('   → Someone (or you) accidentally deleted the key from dashboard');
console.log('   → Check: https://app.sendgrid.com/settings/api_keys');
console.log('   → Look for this key - if it shows "Revoked" or is missing, that\'s the issue\n');

console.log('5. ⚠️ Domain Authentication Not Complete');
console.log('   → For production use, domain should be authenticated');
console.log('   → Check: https://app.sendgrid.com/settings/sender_auth/domain/create');
console.log('   → This might not block sending but could affect deliverability\n');

console.log('========================================');
console.log('✅ HOW TO FIX RIGHT NOW');
console.log('========================================\n');

console.log('Step 1: Go to SendGrid Dashboard');
console.log('   → https://app.sendgrid.com/settings/api_keys\n');

console.log('Step 2: Check Current Key Status');
console.log('   → Look for a key you created recently');
console.log('   → Check if it says "Active" or "Revoked"');
console.log('   → Check the "Scopes" column - should show "Full Access" or have "Mail Send"\n');

console.log('Step 3: Create NEW API Key (Recommended)');
console.log('   → Click "Create API Key" button');
console.log('   → Name: "LOBAISEO_Production_' + new Date().getTime() + '"');
console.log('   → API Key Permissions: Select "Full Access"');
console.log('   → Click "Create & View"');
console.log('   → COPY THE ENTIRE KEY (you only see it once!)\n');

console.log('Step 4: Update .env File');
console.log('   → Open: server/.env');
console.log('   → Replace the SENDGRID_API_KEY line with the new key');
console.log('   → Save the file\n');

console.log('Step 5: Verify Sender Email');
console.log('   → Go to: https://app.sendgrid.com/settings/sender_auth/senders');
console.log('   → If support@lobaiseo.com is NOT there:');
console.log('      - Click "Create New Sender"');
console.log('      - Fill in your details');
console.log('      - Use "support@lobaiseo.com" as email');
console.log('      - Check your email for verification link');
console.log('   → Wait for "Verified" status before testing\n');

console.log('Step 6: Test Again');
console.log('   → Run: node server/test-send-email-direct.js');
console.log('   → Should succeed with "✅ Email sent successfully!"\n');

console.log('========================================');
console.log('📋 CURRENT CONFIGURATION');
console.log('========================================\n');

console.log('From Email:', process.env.SENDGRID_FROM_EMAIL || 'NOT SET');
console.log('From Name:', process.env.SENDGRID_FROM_NAME || 'NOT SET');
console.log('API Key Length:', apiKey ? apiKey.length + ' characters' : 'NOT SET');
console.log('');

console.log('========================================');
console.log('💡 QUICK TIP');
console.log('========================================\n');
console.log('If you JUST created the SendGrid account:');
console.log('  1. Check your email for account verification');
console.log('  2. Complete sender identity verification');
console.log('  3. Wait 5-10 minutes for all verifications to process');
console.log('  4. Then create a new API key with Full Access');
console.log('');
console.log('SendGrid is very strict about new accounts to prevent spam!');
console.log('========================================\n');
