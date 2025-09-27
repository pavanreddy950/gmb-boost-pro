import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

// Fetch the actual Google review link for a location
router.post('/fetch-google-review-link', async (req, res) => {
  try {
    const { accountId, locationId, accessToken } = req.body;
    
    if (!accountId || !locationId || !accessToken) {
      return res.status(400).json({ 
        error: 'Account ID, Location ID, and access token are required' 
      });
    }
    
    console.log(`[Google Review Link] Fetching for account: ${accountId}, location: ${locationId}`);
    
    // Method 1: Try to get from Google My Business API v4 with specific fields
    try {
      const gmb4Url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}?fields=name,locationName,newReviewUrl,metadata`;
      
      const response = await fetch(gmb4Url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Google Review Link] GMB v4 data:', JSON.stringify(data, null, 2));
        
        // Check for newReviewUrl in the response
        if (data.newReviewUrl) {
          console.log('[Google Review Link] Found review URL:', data.newReviewUrl);
          return res.json({ 
            success: true,
            reviewLink: data.newReviewUrl,
            source: 'gmb_v4'
          });
        }
      }
    } catch (error) {
      console.error('GMB v4 API error:', error);
    }
    
    // Method 2: Try the newer API
    try {
      const locationName = `accounts/${accountId}/locations/${locationId}`;
      const newApiUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}`;
      
      const response = await fetch(newApiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Google Review Link] Account Management API data:', data);
        
        // Check for newReviewUri
        if (data.newReviewUri) {
          console.log('[Google Review Link] Found review URI:', data.newReviewUri);
          return res.json({ 
            success: true,
            reviewLink: data.newReviewUri,
            source: 'account_management'
          });
        }
      }
    } catch (error) {
      console.error('Account Management API error:', error);
    }
    
    // Method 3: Try to construct the g.page link
    // Google's g.page links use a special encoding of the location data
    try {
      // First get the location details
      const locationName = `locations/${locationId}`;
      const infoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}`;
      
      const response = await fetch(infoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('[Google Review Link] Business Info data:', JSON.stringify(data, null, 2));
        
        // Check for websiteUri first - it might have the Maps link
        if (data.websiteUri) {
          console.log('[Google Review Link] Found websiteUri:', data.websiteUri);
          // If it's a maps.google.com or goo.gl/maps link, extract the CID
          if (data.websiteUri.includes('maps.google.com') || data.websiteUri.includes('goo.gl/maps')) {
            const cidMatch = data.websiteUri.match(/cid=(\d+)/);
            if (cidMatch) {
              const cid = cidMatch[1];
              // For g.page links, we need to encode the CID properly
              // The format is a URL-safe base64 encoding of the CID as a hex string
              const hexCid = BigInt(cid).toString(16).toUpperCase();
              // Pad to ensure even number of characters
              const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;
              // Convert hex to buffer then to base64url
              const buffer = Buffer.from(paddedHex, 'hex');
              const encodedCid = buffer.toString('base64url');
              const reviewLink = `https://g.page/r/${encodedCid}/review`;
              console.log('[Google Review Link] Constructed g.page link from websiteUri CID:', reviewLink);
              return res.json({ 
                success: true,
                reviewLink,
                source: 'website_cid'
              });
            }
          }
        }
        
        // Check if we have a placeId
        if (data.metadata?.placeId || data.placeId) {
          const placeId = data.metadata?.placeId || data.placeId;
          // Place IDs that start with ChIJ can be used for review links
          if (placeId.startsWith('ChIJ')) {
            const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
            console.log('[Google Review Link] Constructed from Place ID:', reviewLink);
            return res.json({ 
              success: true,
              reviewLink,
              source: 'place_id'
            });
          }
        }
        
        // Check for mapsUri which might contain the CID
        if (data.metadata?.mapsUri || data.mapsUri) {
          const mapsUri = data.metadata?.mapsUri || data.mapsUri;
          console.log('[Google Review Link] Found mapsUri:', mapsUri);
          // Extract CID from maps URI if present
          const cidMatch = mapsUri.match(/cid=(\d+)/);
          if (cidMatch) {
            const cid = cidMatch[1];
            // For g.page links, we need to encode the CID properly
            // The format is a URL-safe base64 encoding of the CID as a hex string
            const hexCid = BigInt(cid).toString(16).toUpperCase();
            // Pad to ensure even number of characters
            const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;
            // Convert hex to buffer then to base64url
            const buffer = Buffer.from(paddedHex, 'hex');
            const encodedCid = buffer.toString('base64url');
            const reviewLink = `https://g.page/r/${encodedCid}/review`;
            console.log('[Google Review Link] Constructed g.page link from CID:', reviewLink);
            return res.json({ 
              success: true,
              reviewLink,
              source: 'cid'
            });
          }
        }
      }
    } catch (error) {
      console.error('Business Information API error:', error);
    }
    
    // If all methods fail, return null
    console.log('[Google Review Link] Could not fetch review link');
    res.json({ 
      success: false,
      reviewLink: null,
      message: 'Could not fetch Google review link'
    });
    
  } catch (error) {
    console.error('Error fetching Google review link:', error);
    res.status(500).json({ 
      error: 'Failed to fetch Google review link',
      message: error.message 
    });
  }
});

export default router;