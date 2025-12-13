import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

const GOOGLE_PLACES_API_KEY = 'AIzaSyD_VdlmkU12eqs2g6rRcT0p0TndqbFhlW4';

/**
 * Get Place ID from business name and location
 * GET /api/places/get-place-id?business=BUSINESS_NAME&location=LOCATION
 */
router.get('/get-place-id', async (req, res) => {
  try {
    const { business, location } = req.query;
    
    if (!business || !location) {
      return res.status(400).json({ error: 'Business name and location are required' });
    }
    
    console.log(`🔍 Fetching Place ID for: ${business}, ${location}`);
    
    // Use Google Places API - Find Place from Text
    const query = `${business} ${location}`;
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${GOOGLE_PLACES_API_KEY}`;
    
    console.log('📡 Calling Google Places API...');
    const response = await fetch(url);
    const data = await response.json();
    
    console.log('📥 Google Places API response:', JSON.stringify(data, null, 2));
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const placeId = data.candidates[0].place_id;
      const placeName = data.candidates[0].name;
      
      console.log(`✅ Found Place ID: ${placeId} for ${placeName}`);
      
      return res.json({
        success: true,
        placeId,
        placeName,
        reviewUrl: `https://search.google.com/local/writereview?placeid=${placeId}`
      });
    } else {
      console.error('❌ No place found or API error:', data.status, data.error_message);
      return res.status(404).json({ 
        error: 'Place not found', 
        status: data.status,
        message: data.error_message 
      });
    }
  } catch (error) {
    console.error('❌ Error fetching Place ID:', error);
    res.status(500).json({ error: 'Failed to fetch Place ID', details: error.message });
  }
});

export default router;
