// Test Google Places API Integration
// Run: node test-places-api.js

import fetch from 'node-fetch';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;

async function testPlacesAPI() {
  console.log('\n🧪 Testing Google Places API Integration\n');
  console.log('='.repeat(60));
  
  // Test business
  const businessName = 'SITARAM GUEST HOUSE';
  const address = 'Varanasi';
  const query = `${businessName} ${address}`;
  
  console.log(`\n📍 Searching for: ${query}`);
  console.log(`🔑 API Key: ${API_KEY ? API_KEY.substring(0, 10) + '...' : 'NOT SET'}\n`);
  
  if (!API_KEY || API_KEY === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    console.error('❌ ERROR: Google Places API key not configured');
    console.error('Please set GOOGLE_PLACES_API_KEY in .env file');
    return;
  }
  
  try {
    // Call Places API
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${API_KEY}`;
    
    console.log('🌐 Calling Google Places API...\n');
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`📊 Response Status: ${data.status}\n`);
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const place = data.candidates[0];
      
      console.log('✅ SUCCESS! Place found:\n');
      console.log(`   Name: ${place.name}`);
      console.log(`   Address: ${place.formatted_address || 'N/A'}`);
      console.log(`   Place ID: ${place.place_id}\n`);
      
      // Convert to review links
      const placeId = place.place_id;
      
      // Method 1: search.google.com format
      const searchLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      console.log('🔗 Review Link (search.google.com):');
      console.log(`   ${searchLink}\n`);
      
      // Method 2: g.page format (attempt conversion)
      try {
        const base64Part = placeId.substring(4);
        const buffer = Buffer.from(base64Part, 'base64');
        const base64url = buffer.toString('base64url');
        const gPageLink = `https://g.page/r/${base64url}/review`;
        
        console.log('🔗 Review Link (g.page format):');
        console.log(`   ${gPageLink}\n`);
      } catch (error) {
        console.log('⚠️  Could not convert to g.page format\n');
      }
      
      console.log('='.repeat(60));
      console.log('✅ Test PASSED - Places API is working correctly!');
      console.log('='.repeat(60));
      
    } else if (data.status === 'ZERO_RESULTS') {
      console.log('❌ No results found for this business');
      console.log('Try adding more specific details (city, state, etc.)');
    } else if (data.status === 'REQUEST_DENIED') {
      console.error('❌ REQUEST DENIED');
      console.error('Possible issues:');
      console.error('  - API key is invalid');
      console.error('  - Places API not enabled in Google Cloud Console');
      console.error('  - Billing not set up');
      if (data.error_message) {
        console.error(`  - ${data.error_message}`);
      }
    } else if (data.status === 'OVER_QUERY_LIMIT') {
      console.error('❌ OVER QUERY LIMIT');
      console.error('API quota exceeded. Check your Google Cloud Console billing.');
    } else {
      console.error(`❌ Unexpected status: ${data.status}`);
      if (data.error_message) {
        console.error(`Error message: ${data.error_message}`);
      }
    }
    
  } catch (error) {
    console.error('\n❌ Test FAILED');
    console.error(`Error: ${error.message}\n`);
  }
}

// Run test
testPlacesAPI();
