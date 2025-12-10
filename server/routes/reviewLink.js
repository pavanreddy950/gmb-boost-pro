import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Get the review link for a location
router.post('/get-review-link', async (req, res) => {
  try {
    const { locationName, accessToken } = req.body;
    
    if (!locationName || !accessToken) {
      return res.status(400).json({ 
        error: 'Location name and access token are required' 
      });
    }
    
    console.log(`[Review Link] Fetching review URI for location: ${locationName}`);
    
    // Try to get location with newReviewUri field
    const locationUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}`;
    
    try {
      const locationResponse = await fetch(locationUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (locationResponse.ok) {
        const locationData = await locationResponse.json();
        console.log('[Review Link] Location data:', locationData);
        
        // Check if location has newReviewUri
        if (locationData.newReviewUri) {
          return res.json({ 
            success: true,
            reviewLink: locationData.newReviewUri 
          });
        }
      }
    } catch (error) {
      console.error('Error fetching from account management API:', error);
    }
    
    // Try alternative API endpoint
    try {
      const businessInfoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`;
      
      const response = await fetch(businessInfoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Review Link] Business info data:', data);
        
        // Check various fields for review link
        const reviewLink = data.newReviewUri || 
                          data.metadata?.newReviewUrl ||
                          data.metadata?.mapsUri ||
                          null;
        
        if (reviewLink) {
          return res.json({ 
            success: true,
            reviewLink 
          });
        }
        
        // If we have placeId, construct the review link
        if (data.metadata?.placeId || data.placeId) {
          const placeId = data.metadata?.placeId || data.placeId;
          return res.json({ 
            success: true,
            reviewLink: `https://search.google.com/local/writereview?placeid=${placeId}`
          });
        }
      }
    } catch (error) {
      console.error('Error fetching from business information API:', error);
    }
    
    // No review link found
    console.log('[Review Link] ❌ No valid review link found');
    res.json({ 
      success: false,
      reviewLink: null,
      message: 'Could not fetch review link. Please provide a valid Place ID.'
    });
    
  } catch (error) {
    console.error('Error fetching review link:', error);
    res.status(500).json({ 
      error: 'Failed to fetch review link',
      message: error.message 
    });
  }
});

// Generate a review link from business information
router.post('/generate-review-link', async (req, res) => {
  try {
    const { businessName, address, placeId } = req.body;
    
    let reviewLink;
    let fetchedPlaceId = placeId;
    
    // Priority 1: Use provided Place ID if valid
    if (placeId && placeId.startsWith('ChIJ')) {
      reviewLink = `https://g.page/r/${convertPlaceIdToShortCode(placeId)}/review` || 
                   `https://search.google.com/local/writereview?placeid=${placeId}`;
      console.log('[Review Link] ✅ Using provided Place ID:', placeId);
    } else {
      // Priority 2: Fetch Place ID from Google Places API
      const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
      
      if (placesApiKey && businessName) {
        console.log('[Review Link] 🔍 Fetching Place ID from Google Places API...');
        
        try {
          const query = `${businessName} ${address || ''}`.trim();
          const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${placesApiKey}`;
          
          const response = await fetch(url);
          const data = await response.json();
          
          if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
            fetchedPlaceId = data.candidates[0].place_id;
            console.log('[Review Link] ✅ Found Place ID from Places API:', fetchedPlaceId);
            
            // Generate review link with Place ID
            reviewLink = `https://search.google.com/local/writereview?placeid=${fetchedPlaceId}`;
          } else {
            console.log('[Review Link] ⚠️ Places API returned no results:', data.status);
          }
        } catch (error) {
          console.error('[Review Link] ❌ Places API error:', error.message);
        }
      }
      
      // Priority 3: Return error if no review link could be generated
      if (!reviewLink) {
        console.log('[Review Link] ❌ No valid review link could be generated');
        return res.status(400).json({
          error: 'Cannot generate review link',
          message: 'No Place ID available. Please try fetching from Google Business Profile API first.',
          suggestion: 'Make sure the business name and address are correct.'
        });
      }
    }
    
    res.json({ 
      success: true,
      reviewLink,
      placeId: fetchedPlaceId,
      source: fetchedPlaceId === placeId ? 'provided' : 'places_api'
    });
    
  } catch (error) {
    console.error('Error generating review link:', error);
    res.status(500).json({ 
      error: 'Failed to generate review link',
      message: error.message
    });
  }
});

// Helper function to convert Place ID to short code (approximate - may not always work)
function convertPlaceIdToShortCode(placeId) {
  try {
    // This is an approximation and may not work for all Place IDs
    // Google doesn't provide an official API for this conversion
    const base64Part = placeId.substring(4); // Remove 'ChIJ' prefix
    const buffer = Buffer.from(base64Part, 'base64');
    const shortCode = buffer.toString('base64url').replace(/=/g, '');
    return shortCode;
  } catch (error) {
    console.error('[Review Link] Failed to convert Place ID to short code:', error);
    return null;
  }
}

export default router;