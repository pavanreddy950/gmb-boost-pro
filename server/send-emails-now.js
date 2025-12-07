import dynamicDailyActivityScheduler from './services/dynamicDailyActivityScheduler.js';

/**
 * Manual Email Trigger Script
 * Sends daily activity emails to ALL users in database immediately
 */

async function sendEmailsNow() {
  console.log('='.repeat(80));
  console.log('📧 MANUAL EMAIL TRIGGER - SENDING TO ALL USERS NOW');
  console.log('='.repeat(80));
  console.log(`⏰ Triggered at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log('');

  try {
    // Call the sendAllDailyReports function
    const results = await dynamicDailyActivityScheduler.sendAllDailyReports();

    console.log('');
    console.log('='.repeat(80));
    console.log('✅ EMAIL SENDING COMPLETE');
    console.log('='.repeat(80));
    console.log('📊 Results:');
    console.log(`   Total users: ${results.total}`);
    console.log(`   ✅ Sent: ${results.sent}`);
    console.log(`   ⏭️  Skipped: ${results.skipped}`);
    console.log(`   ❌ Failed: ${results.failed}`);
    console.log('');

    if (results.details && results.details.length > 0) {
      console.log('📧 Details:');
      results.details.forEach((detail, index) => {
        const statusIcon = detail.result === 'sent' ? '✅' : detail.result === 'skipped' ? '⏭️' : '❌';
        console.log(`   ${index + 1}. ${statusIcon} ${detail.email} (${detail.status}) - ${detail.result}`);
        if (detail.reason) console.log(`      Reason: ${detail.reason}`);
        if (detail.error) console.log(`      Error: ${detail.error}`);
      });
    }

    console.log('');
    console.log('='.repeat(80));

    process.exit(0);
  } catch (error) {
    console.error('');
    console.error('='.repeat(80));
    console.error('❌ ERROR SENDING EMAILS');
    console.error('='.repeat(80));
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    console.error('='.repeat(80));
    process.exit(1);
  }
}

// Run the function
sendEmailsNow();
