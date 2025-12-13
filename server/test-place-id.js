const fetch = require('node-fetch');

const API_KEY = 'AIzaSyD_VdlmkU12eqs2g6rRcT0p0TndqbFhlW4';
const businessName = 'SITARAM GUEST HOUSE';
const address = 'Varanasi';

async function testPlacesAPI() {
  try {
    const query = `${businessName} ${address}`.trim();
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${API_KEY}`;
    
    console.log('🔍 Testing Google Places API...');
    console.log('Query:', query);
    console.log('URL:', url);
    console.log('');
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const placeId = data.candidates[0].place_id;
      const placeName = data.candidates[0].name;
      
      console.log('');
      console.log('✅ Success!');
      console.log('Place ID:', placeId);
      console.log('Place Name:', placeName);
      console.log('');
      console.log('🔗 Review Link (search.google.com):');
      console.log(`https://search.google.com/local/writereview?placeid=${placeId}`);
      console.log('');
      console.log('🔗 Alternative format:');
      console.log(`https://www.google.com/maps/place/?q=place_id:${placeId}`);
    } else {
      console.log('');
      console.log('❌ No results found or API error');
      console.log('Status:', data.status);
      if (data.error_message) {
        console.log('Error message:', data.error_message);
      }
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testPlacesAPI();
