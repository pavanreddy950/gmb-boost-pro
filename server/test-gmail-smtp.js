import dotenv from 'dotenv';
import gmailService from './services/gmailService.js';

dotenv.config();

console.log('========================================');
console.log('📧 TESTING GMAIL SMTP EMAIL SERVICE');
console.log('========================================\n');

async function testGmailSMTP() {
  try {
    console.log('Configuration:');
    console.log(`   Gmail User: ${process.env.GMAIL_USER}`);
    console.log(`   Gmail From Name: ${process.env.GMAIL_FROM_NAME || 'LOBAISEO'}`);
    console.log(`   App Password: ${process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not set'}`);
    console.log('');

    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
      console.error('❌ Gmail credentials not set in .env file!');
      console.error('   Make sure GMAIL_USER and GMAIL_APP_PASSWORD are set.');
      process.exit(1);
    }

    console.log('Sending test email...\n');

    // Test 1: Send to scalepointstrategy@gmail.com
    console.log('📧 Test 1: Sending to scalepointstrategy@gmail.com');
    const result1 = await gmailService.sendTestEmail('scalepointstrategy@gmail.com');

    if (result1.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result1.messageId}`);
    } else {
      console.error('❌ Email failed:', result1.error);
    }
    console.log('');

    // Test 2: Send to meenakarjale73@gmail.com
    console.log('📧 Test 2: Sending to meenakarjale73@gmail.com');
    const result2 = await gmailService.sendTestEmail('meenakarjale73@gmail.com');

    if (result2.success) {
      console.log('✅ Email sent successfully!');
      console.log(`   Message ID: ${result2.messageId}`);
    } else {
      console.error('❌ Email failed:', result2.error);
    }
    console.log('');

    console.log('========================================');
    console.log('🎉 TEST COMPLETED');
    console.log('========================================\n');
    console.log('Check your inbox for the test emails!');
    console.log('');
    console.log('If you received the emails:');
    console.log('   ✅ Gmail SMTP is working perfectly');
    console.log('   ✅ Emails will be sent 24/7 automatically');
    console.log('   ✅ No SendGrid verification needed!');
    console.log('');

  } catch (error) {
    console.error('❌ Error during test:', error);
    process.exit(1);
  }
}

testGmailSMTP().then(() => {
  process.exit(0);
});
