import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:5000';
const TEST_LOCATION_ID = 'test-location-123';

console.log('🔍 AUTOMATION MONITOR');
console.log('═'.repeat(60));
console.log('Monitoring automation status every 30 seconds...');
console.log('Press Ctrl+C to stop\n');

let checkCount = 0;
const maxChecks = 20; // Monitor for 10 minutes (20 checks × 30 seconds)

async function checkStatus() {
  checkCount++;
  const now = new Date();

  console.log(`\n[${now.toLocaleTimeString()}] Check #${checkCount}/${maxChecks}`);
  console.log('─'.repeat(60));

  try {
    // Check automation status
    const statusResponse = await fetch(`${BACKEND_URL}/api/automation/status/${TEST_LOCATION_ID}`);

    if (!statusResponse.ok) {
      throw new Error(`HTTP ${statusResponse.status}`);
    }

    const status = await statusResponse.json();

    console.log('📊 Automation Status:');
    console.log(`   Enabled: ${status.autoPosting?.enabled ? '✅' : '❌'}`);
    console.log(`   Schedule: ${status.autoPosting?.schedule || 'Not set'}`);
    console.log(`   Frequency: ${status.autoPosting?.frequency || 'Not set'}`);
    console.log(`   Last run: ${status.autoPosting?.lastRun || 'Never'}`);
    console.log(`   Is running: ${status.autoPosting?.isRunning ? '✅' : '❌'}`);

    if (status.autoPosting?.lastRun) {
      const lastRun = new Date(status.autoPosting.lastRun);
      console.log(`\n✅ POST CREATED! at ${lastRun.toLocaleTimeString()}`);
      console.log('🎉 Scheduled posting is working correctly!');
      console.log('\nMonitoring complete.');
      process.exit(0);
    }

    // Check automation logs
    const logsResponse = await fetch(`${BACKEND_URL}/api/automation/logs`);
    if (logsResponse.ok) {
      const logs = await logsResponse.json();
      const recentLogs = logs.activities?.slice(-3) || [];

      if (recentLogs.length > 0) {
        console.log('\n📜 Recent Activity:');
        recentLogs.forEach(log => {
          const time = new Date(log.timestamp).toLocaleTimeString();
          console.log(`   [${time}] ${log.type} - Location: ${log.locationId}`);
        });
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }

  if (checkCount >= maxChecks) {
    console.log('\n⏱️  Monitoring period ended (10 minutes)');
    console.log('If post was not created, there might be an issue.');
    process.exit(0);
  }
}

// Initial check
checkStatus();

// Check every 30 seconds
const interval = setInterval(checkStatus, 30 * 1000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  clearInterval(interval);
  console.log('\n\n👋 Monitoring stopped by user');
  process.exit(0);
});
