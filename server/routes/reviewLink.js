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
    
    // Final fallback: construct search link
    const businessName = req.body.businessName || 'business';
    const address = req.body.address || '';
    const searchQuery = encodeURIComponent(`${businessName} ${address}`);
    const fallbackLink = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
    
    res.json({ 
      success: true,
      reviewLink: fallbackLink,
      isFallback: true
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
    
    if (placeId && placeId.startsWith('ChIJ')) {
      // Valid Google Place ID
      reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
    } else {
      // Generate a Google Maps search link
      const searchQuery = encodeURIComponent(`${businessName} ${address}`);
      reviewLink = `https://www.google.com/maps/search/?api=1&query=${searchQuery}`;
    }
    
    res.json({ 
      success: true,
      reviewLink 
    });
    
  } catch (error) {
    console.error('Error generating review link:', error);
    res.status(500).json({ 
      error: 'Failed to generate review link' 
    });
  }
});

export default router;