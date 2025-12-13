import fetch from 'node-fetch';

const GOOGLE_PLACES_API_KEY = 'AIzaSyD_VdlmkU12eqs2g6rRcT0p0TndqbFhlW4';

async function fetchPlaceId() {
  try {
    const businessName = 'SITARAM GUEST HOUSE';
    const location = 'Varanasi';
    const query = `${businessName} ${location}`;
    
    console.log('🔍 Searching for:', query);
    
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name,formatted_address&key=${GOOGLE_PLACES_API_KEY}`;
    
    console.log('🌐 Calling Google Places API...\n');
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('📊 API Response:');
    console.log(JSON.stringify(data, null, 2));
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const placeId = data.candidates[0].place_id;
      const name = data.candidates[0].name;
      const address = data.candidates[0].formatted_address;
      
      console.log('\n✅ SUCCESS!');
      console.log('Place ID:', placeId);
      console.log('Name:', name);
      console.log('Address:', address);
      
      // Generate review link
      const reviewLink1 = `https://search.google.com/local/writereview?placeid=${placeId}`;
      const reviewLink2 = `https://g.page/r/${placeId}/review`;
      
      console.log('\n🔗 Review Links:');
      console.log('Format 1:', reviewLink1);
      console.log('Format 2:', reviewLink2);
      
    } else {
      console.log('\n❌ No results found');
      console.log('Status:', data.status);
      if (data.error_message) {
        console.log('Error:', data.error_message);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

fetchPlaceId();
