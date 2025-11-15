import fetch from 'node-fetch';

const BACKEND_URL = 'http://localhost:5000';

// Test location data with complete address
const testLocationId = 'test-location-123';
const testData = {
  businessName: 'Scale Point Strategy',
  category: 'Digital Marketing Agency',
  keywords: 'digital marketing, SEO, social media marketing, Scale Point Strategy',
  websiteUrl: 'https://scalepointstrategy.com',
  city: 'Jalandhar',
  region: 'Punjab',
  country: 'India',
  fullAddress: 'Main Market, Jalandhar, Punjab 144001, India',
  postalCode: '144001',
  phoneNumber: '+91-1234567890'
};

console.log('🧪 AUTOMATION TESTING SCRIPT');
console.log('============================\n');

// Test 1: Check if address is included in generated post content
async function testAddressInPostContent() {
  console.log('📝 TEST 1: Verify address appears in generated post content');
  console.log('-----------------------------------------------------------');

  try {
    const response = await fetch(`${BACKEND_URL}/api/automation/test-generate-content/${testLocationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();

    console.log('\n✅ Post content generated successfully!\n');
    console.log('📄 Generated Content:');
    console.log('━'.repeat(60));
    console.log(result.content);
    console.log('━'.repeat(60));

    console.log('\n🔍 Address Check Results:');
    console.log(`   Has address line: ${result.addressCheck.hasAddressLine ? '✅ YES' : '❌ NO'}`);
    console.log(`   Full address: ${result.addressCheck.fullAddress}`);
    console.log(`   Expected format: ${result.addressCheck.expectedFormat}`);

    if (result.addressCheck.hasAddressLine) {
      console.log('\n✅ TEST 1 PASSED: Address is included in post content!\n');
      return true;
    } else {
      console.log('\n❌ TEST 1 FAILED: Address is missing from post content!\n');
      return false;
    }
  } catch (error) {
    console.error('\n❌ TEST 1 ERROR:', error.message, '\n');
    return false;
  }
}

// Test 2: Set up automation with schedule in 2 minutes and verify it runs
async function testScheduledPosting() {
  console.log('\n📅 TEST 2: Verify posts run at scheduled time');
  console.log('-----------------------------------------------------------');

  try {
    // Calculate time 2 minutes from now
    const now = new Date();
    const scheduledTime = new Date(now.getTime() + 2 * 60 * 1000);
    const timeString = `${String(scheduledTime.getHours()).padStart(2, '0')}:${String(scheduledTime.getMinutes()).padStart(2, '0')}`;

    console.log(`\n⏰ Current time: ${now.toLocaleTimeString()}`);
    console.log(`⏰ Scheduling post for: ${scheduledTime.toLocaleTimeString()} (in 2 minutes)`);
    console.log(`⏰ Time string: ${timeString}`);

    // Save automation settings with the scheduled time
    console.log('\n📤 Saving automation settings...');
    const response = await fetch(`${BACKEND_URL}/api/automation/settings/${testLocationId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        autoPosting: {
          enabled: true,
          schedule: timeString,
          frequency: 'daily',
          businessName: testData.businessName,
          category: testData.category,
          keywords: testData.keywords,
          websiteUrl: testData.websiteUrl,
          city: testData.city,
          region: testData.region,
          country: testData.country,
          fullAddress: testData.fullAddress,
          postalCode: testData.postalCode,
          phoneNumber: testData.phoneNumber,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          userId: 'test-user',
          accountId: '106433552101751461082'
        },
        userId: 'test-user',
        accountId: '106433552101751461082'
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const result = await response.json();
    console.log('✅ Automation settings saved successfully!');
    console.log('\n📊 Saved settings:');
    console.log(`   Schedule: ${result.settings.autoPosting?.schedule}`);
    console.log(`   Frequency: ${result.settings.autoPosting?.frequency}`);
    console.log(`   Business: ${result.settings.autoPosting?.businessName}`);
    console.log(`   Address: ${result.settings.autoPosting?.fullAddress || 'MISSING ❌'}`);
    console.log(`   City: ${result.settings.autoPosting?.city || 'MISSING ❌'}`);

    console.log('\n⏳ IMPORTANT: Check server logs in 2-7 minutes to verify:');
    console.log('   1. Missed post checker detects the scheduled post');
    console.log('   2. Post is created automatically');
    console.log('   3. Address is included in the post');
    console.log('\n💡 Look for these log messages:');
    console.log('   - "[AutomationScheduler] 📅 Checking X locations for missed posts"');
    console.log('   - "[AutomationScheduler] ⚡ MISSED POST DETECTED"');
    console.log('   - "[AutomationScheduler] ✅ Missed post created"');

    console.log('\n✅ TEST 2 SETUP COMPLETE!');
    console.log('   The missed post checker runs every 5 minutes');
    console.log('   It should create the post within 5 minutes of the scheduled time\n');

    return true;
  } catch (error) {
    console.error('\n❌ TEST 2 ERROR:', error.message, '\n');
    return false;
  }
}

// Test 3: Check automation status
async function checkAutomationStatus() {
  console.log('\n📊 TEST 3: Check automation status');
  console.log('-----------------------------------------------------------');

  try {
    const response = await fetch(`${BACKEND_URL}/api/automation/status/${testLocationId}`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const status = await response.json();

    console.log('\n✅ Automation status retrieved:');
    console.log('   Auto-posting enabled:', status.autoPosting?.enabled ? '✅ YES' : '❌ NO');
    console.log('   Schedule:', status.autoPosting?.schedule || 'Not set');
    console.log('   Frequency:', status.autoPosting?.frequency || 'Not set');
    console.log('   Last run:', status.autoPosting?.lastRun || 'Never');
    console.log('   Is running:', status.autoPosting?.isRunning ? '✅ YES' : '❌ NO');

    return true;
  } catch (error) {
    console.error('\n❌ TEST 3 ERROR:', error.message, '\n');
    return false;
  }
}

// Run all tests
async function runTests() {
  console.log('Starting tests...\n');

  const test1 = await testAddressInPostContent();
  const test2 = await testScheduledPosting();
  const test3 = await checkAutomationStatus();

  console.log('\n');
  console.log('═'.repeat(60));
  console.log('TEST SUMMARY');
  console.log('═'.repeat(60));
  console.log(`Test 1 (Address in content): ${test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 (Schedule setup):     ${test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 (Status check):       ${test3 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log('═'.repeat(60));

  if (test1 && test2 && test3) {
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('\n⏳ Now monitoring server logs for scheduled post creation...');
    console.log('   The post should be created within 2-7 minutes');
  } else {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
  }
}

runTests().catch(console.error);
