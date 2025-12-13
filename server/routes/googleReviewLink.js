import express from 'express';
import fetch from 'node-fetch';

const router = express.Router();

/**
 * Extract Place ID from various Google Maps URL formats
 * Supports:
 * - CID format: /cid=123456789
 * - Hex format: 0x398e2f5138510757:0x70a831a7bb280000 (in URL path)
 * - Place ID format: ChIJ...
 */
function extractPlaceIdFromMapsUrl(url) {
  if (!url) return null;
  
  console.log('[Place ID Extract] Input URL:', url);
  
  // Check if it's already a Place ID
  const placeIdMatch = url.match(/ChIJ[\w-]+/);
  if (placeIdMatch) {
    console.log('[Place ID Extract] Found Place ID:', placeIdMatch[0]);
    return placeIdMatch[0];
  }
  
  // Extract CID from URL
  const cidMatch = url.match(/cid=(\d+)/);
  if (cidMatch) {
    const cid = cidMatch[1];
    console.log('[Place ID Extract] Found CID:', cid);
    // Convert CID to hex format for g.page link
    const hexCid = BigInt(cid).toString(16).toUpperCase();
    const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;
    const buffer = Buffer.from(paddedHex, 'hex');
    const encodedCid = buffer.toString('base64url');
    return `g.page:${encodedCid}`; // Special marker for g.page links
  }
  
  // Extract hex format: 0x398e2f5138510757:0x70a831a7bb280000
  const hexMatch = url.match(/0x([0-9a-fA-F]+):0x([0-9a-fA-F]+)/);
  if (hexMatch) {
    const hex1 = hexMatch[1];
    const hex2 = hexMatch[2];
    console.log('[Place ID Extract] Found hex format:', hex1, hex2);
    
    // Convert hex to CID
    const cid = BigInt('0x' + hex2).toString();
    console.log('[Place ID Extract] Converted to CID:', cid);
    
    // Convert CID to base64url for g.page
    const buffer = Buffer.from(hex2, 'hex');
    const encodedCid = buffer.toString('base64url');
    return `g.page:${encodedCid}`;
  }
  
  console.log('[Place ID Extract] No Place ID found in URL');
  return null;
}

/**
 * Convert extracted identifier to review link
 */
function createReviewLinkFromIdentifier(identifier) {
  if (!identifier) return null;
  
  // If it's a regular Place ID
  if (identifier.startsWith('ChIJ')) {
    return `https://search.google.com/local/writereview?placeid=${identifier}`;
  }
  
  // If it's a g.page identifier
  if (identifier.startsWith('g.page:')) {
    const encodedCid = identifier.replace('g.page:', '');
    return `https://g.page/r/${encodedCid}/review`;
  }
  
  return null;
}

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

      console.log('[Google Review Link] Method 1: Trying GMB v4 API...');
      console.log('[Google Review Link] URL:', gmb4Url);

      const response = await fetch(gmb4Url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Google Review Link] GMB v4 response status:', response.status);

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
        console.log('[Google Review Link] GMB v4: No newReviewUrl found in response');
      } else {
        const errorText = await response.text();
        console.log('[Google Review Link] GMB v4 failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Google Review Link] GMB v4 API error:', error.message);
    }
    
    // Method 2: Try the newer API
    try {
      const locationName = `accounts/${accountId}/locations/${locationId}`;
      const newApiUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}`;

      console.log('[Google Review Link] Method 2: Trying Account Management API...');
      console.log('[Google Review Link] URL:', newApiUrl);

      const response = await fetch(newApiUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Google Review Link] Account Management API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Google Review Link] Account Management API data:', JSON.stringify(data, null, 2));

        // Check for newReviewUri
        if (data.newReviewUri) {
          console.log('[Google Review Link] Found review URI:', data.newReviewUri);
          return res.json({
            success: true,
            reviewLink: data.newReviewUri,
            source: 'account_management'
          });
        }
        console.log('[Google Review Link] Account Management API: No newReviewUri found');
      } else {
        const errorText = await response.text();
        console.log('[Google Review Link] Account Management API failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Google Review Link] Account Management API error:', error.message);
    }
    
    // Method 3: Try to get from Business Information API with proper readMask for metadata
    try {
      // First get the location details with readMask to include metadata (which contains newReviewUri)
      const locationName = `locations/${locationId}`;
      const infoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,metadata`;

      console.log('[Google Review Link] Method 3: Trying Business Information API...');
      console.log('[Google Review Link] URL:', infoUrl);

      const response = await fetch(infoUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('[Google Review Link] Business Info API response status:', response.status);

      if (response.ok) {
        const data = await response.json();
        console.log('[Google Review Link] Business Info data:', JSON.stringify(data, null, 2));

        // Check for metadata.newReviewUri first (this is the official field in metadata)
        if (data.metadata?.newReviewUri) {
          console.log('[Google Review Link] Found metadata.newReviewUri:', data.metadata.newReviewUri);
          return res.json({
            success: true,
            reviewLink: data.metadata.newReviewUri,
            source: 'business_info_metadata_new_review_uri'
          });
        }
        console.log('[Google Review Link] Business Info API: No metadata.newReviewUri found');

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
      } else {
        const errorText = await response.text();
        console.log('[Google Review Link] Business Info API failed:', response.status, errorText);
      }
    } catch (error) {
      console.error('[Google Review Link] Business Information API error:', error.message);
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

// NEW: Extract review link from Google Maps URL
router.post('/extract-from-maps-url', async (req, res) => {
  try {
    const { mapsUrl } = req.body;
    
    if (!mapsUrl) {
      return res.status(400).json({ 
        error: 'Maps URL is required' 
      });
    }
    
    console.log('[Extract Maps URL] Processing:', mapsUrl);
    
    const identifier = extractPlaceIdFromMapsUrl(mapsUrl);
    if (!identifier) {
      return res.json({
        success: false,
        message: 'Could not extract Place ID or CID from the Maps URL'
      });
    }
    
    const reviewLink = createReviewLinkFromIdentifier(identifier);
    if (!reviewLink) {
      return res.json({
        success: false,
        message: 'Could not create review link from extracted identifier'
      });
    }
    
    console.log('[Extract Maps URL] Generated review link:', reviewLink);
    
    return res.json({
      success: true,
      reviewLink,
      source: 'maps_url_extraction'
    });
    
  } catch (error) {
    console.error('[Extract Maps URL] Error:', error);
    res.status(500).json({ 
      error: 'Failed to extract review link from Maps URL',
      message: error.message 
    });
  }
});

export default router;