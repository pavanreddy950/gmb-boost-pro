// Test script to fetch Google review link
const fetch = require('node-fetch');

async function testReviewLink() {
  console.log('🔍 Testing Google Review Link API...\n');

  // From the console logs:
  // Location ID: 13590844868409001032 (SANGMESHWAR TRADING COMPANY)
  // Account ID: 104704598843100767352

  const accountId = '104704598843100767352';
  const locationId = '13590844868409001032';

  // First, get the access token from your stored tokens
  // You'll need to be logged in to the app for this to work
  console.log('📋 Test Parameters:');
  console.log(`   Account ID: ${accountId}`);
  console.log(`   Location ID: ${locationId}`);
  console.log('\n⚠️  NOTE: You need a valid access token to test this.');
  console.log('   Please provide your access token or run this test through the frontend.\n');

  // If you have an access token, uncomment and use this:
  /*
  const accessToken = 'YOUR_ACCESS_TOKEN_HERE';

  try {
    console.log('🚀 Calling API endpoint: POST /api/google-review/fetch-google-review-link\n');

    const response = await fetch('http://localhost:5000/api/google-review/fetch-google-review-link', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        accountId,
        locationId,
        accessToken
      })
    });

    const data = await response.json();

    console.log('📥 API Response:');
    console.log(JSON.stringify(data, null, 2));

    if (data.success && data.reviewLink) {
      console.log('\n✅ SUCCESS! Review link retrieved:');
      console.log(`   ${data.reviewLink}`);
      console.log(`   Source: ${data.source}`);
    } else {
      console.log('\n❌ FAILED to get review link');
      console.log(`   Message: ${data.message}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  */
}

testReviewLink();
