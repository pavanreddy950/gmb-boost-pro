import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Google Places API Key
const GOOGLE_PLACES_API_KEY = 'AIzaSyD_VdlmkU12eqs2g6rRcT0p0TndqbFhlW4';

/**
 * Get real rank position for a business using Google Places API
 * POST /api/rank-tracking/get-rank
 * Body: { businessName, latitude, longitude, placeId }
 */
router.post('/get-rank', async (req, res) => {
  try {
    const { businessName, latitude, longitude, placeId, category } = req.body;

    if (!businessName || !latitude || !longitude) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'businessName, latitude, and longitude are required'
      });
    }

    console.log(`🔍 Fetching rank for: ${businessName} at ${latitude},${longitude}`);

    // Determine search keyword based on category if available
    const searchKeyword = category || businessName;

    // Use Google Places API Nearby Search to get ranked businesses
    const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&keyword=${encodeURIComponent(searchKeyword)}&rankby=prominence&key=${GOOGLE_PLACES_API_KEY}`;

    const placesResponse = await fetch(placesUrl);
    const placesData = await placesResponse.json();

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      console.error('❌ Places API error:', placesData);
      return res.status(500).json({
        error: 'Google Places API error',
        message: placesData.error_message || placesData.status,
        status: placesData.status
      });
    }

    if (!placesData.results || placesData.results.length === 0) {
      console.log('⚠️ No results found for this location');
      return res.json({
        rank: 30, // Unranked
        totalResults: 0,
        found: false,
        message: 'Business not found in search results'
      });
    }

    // Find the business in the results
    let rank = -1;
    let found = false;

    for (let i = 0; i < placesData.results.length; i++) {
      const place = placesData.results[i];

      // Match by place_id (most accurate)
      if (placeId && place.place_id === placeId) {
        rank = i + 1; // Rank is position (1-based index)
        found = true;
        console.log(`✅ Found by place_id at rank ${rank}`);
        break;
      }

      // Match by name (case-insensitive)
      const placeName = place.name.toLowerCase();
      const searchName = businessName.toLowerCase();

      if (placeName.includes(searchName) || searchName.includes(placeName)) {
        rank = i + 1;
        found = true;
        console.log(`✅ Found by name at rank ${rank}: "${place.name}"`);
        break;
      }
    }

    if (!found) {
      // Business exists but not in top results
      console.log(`⚠️ Business "${businessName}" not found in top ${placesData.results.length} results`);
      return res.json({
        rank: 30, // Beyond visible range
        totalResults: placesData.results.length,
        found: false,
        message: 'Business not found in top results'
      });
    }

    // Cap rank at 30 (industry standard for local pack tracking)
    const finalRank = Math.min(rank, 30);

    console.log(`📊 Final rank: ${finalRank}`);

    return res.json({
      rank: finalRank,
      totalResults: placesData.results.length,
      found: true,
      message: 'Rank calculated successfully'
    });

  } catch (error) {
    console.error('❌ Error fetching rank:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * Get rank for multiple locations (batch processing)
 * POST /api/rank-tracking/batch-rank
 * Body: { locations: [{ businessName, latitude, longitude, placeId }] }
 */
router.post('/batch-rank', async (req, res) => {
  try {
    const { locations } = req.body;

    if (!locations || !Array.isArray(locations)) {
      return res.status(400).json({
        error: 'Invalid request',
        message: 'locations array is required'
      });
    }

    console.log(`🔍 Batch rank request for ${locations.length} locations`);

    const results = [];

    // Process each location sequentially to avoid rate limits
    for (const location of locations) {
      try {
        const { businessName, latitude, longitude, placeId, category } = location;

        if (!businessName || !latitude || !longitude) {
          results.push({
            businessName,
            rank: 30,
            error: 'Missing required fields'
          });
          continue;
        }

        const searchKeyword = category || businessName;
        const placesUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${latitude},${longitude}&keyword=${encodeURIComponent(searchKeyword)}&rankby=prominence&key=${GOOGLE_PLACES_API_KEY}`;

        const placesResponse = await fetch(placesUrl);
        const placesData = await placesResponse.json();

        if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
          results.push({
            businessName,
            rank: 30,
            error: placesData.status
          });
          continue;
        }

        if (!placesData.results || placesData.results.length === 0) {
          results.push({
            businessName,
            rank: 30,
            found: false
          });
          continue;
        }

        // Find rank
        let rank = -1;
        let found = false;

        for (let i = 0; i < placesData.results.length; i++) {
          const place = placesData.results[i];

          if (placeId && place.place_id === placeId) {
            rank = i + 1;
            found = true;
            break;
          }

          const placeName = place.name.toLowerCase();
          const searchName = businessName.toLowerCase();

          if (placeName.includes(searchName) || searchName.includes(placeName)) {
            rank = i + 1;
            found = true;
            break;
          }
        }

        const finalRank = found ? Math.min(rank, 30) : 30;

        results.push({
          businessName,
          rank: finalRank,
          found,
          totalResults: placesData.results.length
        });

        // Add small delay to avoid rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error processing ${location.businessName}:`, error);
        results.push({
          businessName: location.businessName,
          rank: 30,
          error: error.message
        });
      }
    }

    return res.json({
      success: true,
      results
    });

  } catch (error) {
    console.error('❌ Error in batch rank:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

export default router;
