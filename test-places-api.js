import fetch from 'node-fetch';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: join(__dirname, 'server', '.env') });

const API_KEY = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;

console.log('🔑 Google Places API Key:', API_KEY ? `${API_KEY.substring(0, 10)}...` : 'NOT FOUND');

async function testPlacesAPI() {
  if (!API_KEY) {
    console.error('❌ No API key found in environment variables');
    return;
  }

  const businessName = 'SITARAM GUEST HOUSE';
  const address = 'Varanasi';
  const query = `${businessName} ${address}`.trim();
  
  console.log(`\n🔍 Searching for: ${query}`);
  
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${API_KEY}`;
  
  console.log(`\n🌐 API URL: ${url.substring(0, 120)}...`);
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('\n📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const placeId = data.candidates[0].place_id;
      const placeName = data.candidates[0].name;
      console.log(`\n✅ SUCCESS!`);
      console.log(`   Place ID: ${placeId}`);
      console.log(`   Name: ${placeName}`);
      
      // Generate review link
      const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      console.log(`\n🔗 Review Link: ${reviewLink}`);
      
      // Alternative g.page format
      const gPageLink = `https://g.page/r/${placeId}/review`;
      console.log(`🔗 G.page Link: ${gPageLink}`);
      
      return { placeId, reviewLink, gPageLink };
    } else {
      console.log(`\n⚠️ API Status: ${data.status}`);
      if (data.error_message) {
        console.log(`   Error: ${data.error_message}`);
      }
    }
  } catch (error) {
    console.error('\n❌ Error:', error.message);
  }
}

testPlacesAPI();
