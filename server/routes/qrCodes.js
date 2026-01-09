import express from 'express';
import QRCode from 'qrcode';
import supabaseQRCodeService from '../services/supabaseQRCodeService.js';
import subscriptionGuard from '../services/subscriptionGuard.js';
import config from '../config.js';
import fetch from 'node-fetch';

const router = express.Router();

// Get all QR codes for user
router.get('/', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }
    const qrCodes = await supabaseQRCodeService.getQRCodesForUser(userId);
    res.json({ qrCodes });
  } catch (error) {
    console.error('Error fetching QR codes:', error);
    res.status(500).json({ error: 'Failed to fetch QR codes' });
  }
});

// Get QR code for specific location
router.get('/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const qrCode = await supabaseQRCodeService.getQRCode(locationId);

    if (!qrCode) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }

    // Keywords are stored directly in qr_codes table - use them as-is
    // No need to fetch from automation_settings (that table doesn't exist in new schema)
    console.log(`[QR Code] 📤 Returning QR code for ${locationId} with keywords: "${qrCode.keywords || 'none'}"`);

    res.json({ qrCode });
  } catch (error) {
    console.error('Error fetching QR code:', error);
    res.status(500).json({ error: 'Failed to fetch QR code' });
  }
});

// Create/Save QR code for location
router.post('/', async (req, res) => {
  try {
    const { locationId, locationName, address, placeId, googleReviewLink, keywords, userId, gbpAccountId, forceRefresh } = req.body;

    if (!locationId || !locationName || !googleReviewLink) {
      return res.status(400).json({
        error: 'Missing required fields: locationId, locationName, googleReviewLink'
      });
    }

    // 🔒 SUBSCRIPTION CHECK - Verify user has valid trial or active subscription
    if (userId && gbpAccountId) {
      console.log(`[QR Codes] 🔒 Validating subscription for user ${userId}, GBP Account: ${gbpAccountId}`);

      const accessCheck = await subscriptionGuard.hasValidAccess(userId, gbpAccountId);

      if (!accessCheck.hasAccess) {
        console.error(`[QR Codes] ❌ SUBSCRIPTION CHECK FAILED`);
        console.error(`[QR Codes] Reason: ${accessCheck.reason}`);
        console.error(`[QR Codes] 🚫 QR CODE CREATION BLOCKED - Trial/Subscription expired!`);

        return res.status(403).json({
          error: accessCheck.message,
          reason: accessCheck.reason,
          requiresPayment: accessCheck.requiresPayment,
          message: 'Your trial/subscription has expired. Please upgrade to create QR codes.'
        });
      }

      console.log(`[QR Codes] ✅ Subscription validated - ${accessCheck.status} (${accessCheck.daysRemaining} days remaining)`);
    } else {
      console.warn(`[QR Codes] ⚠️ No userId/gbpAccountId provided - skipping subscription check`);
    }

    console.log(`[QR Codes] 🔑 Received keywords from form: "${keywords || 'none'}"`);

    // 🔍 Check if QR code already exists (unless forceRefresh is true)
    const existingQR = await supabaseQRCodeService.getQRCode(locationId);
    if (existingQR && !forceRefresh) {
      console.log(`[QR Codes] ♻️ QR code already exists for ${locationName}, updating keywords: "${keywords || 'none'}"`);

      // Update only the keywords and other changed fields
      existingQR.keywords = keywords || '';
      existingQR.googleReviewLink = googleReviewLink;
      existingQR.reviewLink = googleReviewLink;
      existingQR.locationName = locationName;
      existingQR.address = address || '';
      existingQR.placeId = placeId || '';
      existingQR.code = locationId;

      await supabaseQRCodeService.saveQRCode(existingQR);

      console.log(`[QR Codes] ✅ QR code updated with keywords: "${existingQR.keywords || 'none'}"`);

      return res.json({
        success: true,
        qrCode: existingQR,
        message: 'QR code updated successfully',
        cached: true
      });
    }

    console.log(`[QR Codes] ${forceRefresh ? '🔄 Regenerating' : '📦 Creating'} QR code for ${locationName} with keywords: ${keywords || 'none'}`);

    // Generate public review URL using config
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` +
      `business=${encodeURIComponent(locationName)}&` +
      `location=${encodeURIComponent(address || '')}&` +
      `placeId=${encodeURIComponent(placeId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;

    // Generate QR code
    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    // Save to Supabase database with keywords for AI review generation
    const qrCodeData = {
      code: locationId,
      locationId: locationId,
      locationName,
      address: address || '',
      userId: userId || 'anonymous',
      placeId: placeId || '',
      qrDataUrl: qrCodeUrl,
      reviewLink: googleReviewLink,
      googleReviewLink: googleReviewLink,
      publicReviewUrl,
      keywords: keywords || '', // Store keywords for AI to use
      scans: existingQR?.scans || 0, // Preserve scan count if updating
      createdAt: existingQR?.createdAt || new Date().toISOString()
    };

    const savedQRCode = await supabaseQRCodeService.saveQRCode(qrCodeData);

    res.json({
      success: true,
      qrCode: savedQRCode,
      message: forceRefresh ? 'QR code regenerated successfully' : 'QR code created and saved successfully',
      cached: false
    });

  } catch (error) {
    console.error('Error creating QR code:', error);
    res.status(500).json({ error: 'Failed to create QR code' });
  }
});

// Update review link for existing QR code
router.patch('/:locationId/review-link', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { googleReviewLink } = req.body;
    
    if (!googleReviewLink) {
      return res.status(400).json({ error: 'googleReviewLink is required' });
    }

    // Get existing QR code
    const existingQR = await supabaseQRCodeService.getQRCode(locationId);
    if (!existingQR) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }

    // Update review link
    const updatedQR = await supabaseQRCodeService.updateReviewLink(locationId, googleReviewLink);
    
    // Regenerate public URL and QR code with new link
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` + 
      `business=${encodeURIComponent(updatedQR.locationName)}&` +
      `location=${encodeURIComponent(updatedQR.address || '')}&` +
      `placeId=${encodeURIComponent(updatedQR.placeId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;

    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    // Update with new QR code
    updatedQR.qrCodeUrl = qrCodeUrl;
    updatedQR.qrDataUrl = qrCodeUrl;
    updatedQR.publicReviewUrl = publicReviewUrl;
    updatedQR.code = locationId;
    await supabaseQRCodeService.saveQRCode(updatedQR);

    res.json({ 
      success: true,
      qrCode: updatedQR,
      message: 'Review link updated successfully'
    });

  } catch (error) {
    console.error('Error updating review link:', error);
    res.status(500).json({ error: 'Failed to update review link' });
  }
});

// Update keywords for existing QR code
router.patch('/:locationId/keywords', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { keywords } = req.body;

    console.log(`[QR Codes] Updating keywords for location ${locationId}: ${keywords}`);

    // Get existing QR code
    const existingQR = await supabaseQRCodeService.getQRCode(locationId);
    if (!existingQR) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }

    // Update keywords
    existingQR.keywords = keywords || '';
    existingQR.code = locationId;
    await supabaseQRCodeService.saveQRCode(existingQR);

    res.json({
      success: true,
      qrCode: existingQR,
      message: 'Keywords updated successfully'
    });

  } catch (error) {
    console.error('Error updating keywords:', error);
    res.status(500).json({ error: 'Failed to update keywords' });
  }
});

// Re-fetch review link from Google Business Profile API
router.post('/:locationId/refetch-review-link', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { accountId, accessToken, placeId } = req.body;

    if (!accountId || !accessToken) {
      return res.status(400).json({ 
        error: 'accountId and accessToken are required' 
      });
    }

    console.log(`[QR Code] 🔄 Re-fetching review link for location: ${locationId}`);

    // Get existing QR code
    const existingQR = await supabaseQRCodeService.getQRCode(locationId);
    if (!existingQR) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }

    // Try to fetch review link from Google APIs
    const fetchResult = await fetchGoogleReviewLink(accountId, locationId, accessToken, existingQR.locationName, existingQR.address);

    let googleReviewLink = null;

    if (fetchResult.success) {
      googleReviewLink = fetchResult.reviewLink;
      console.log(`[QR Code] ✅ Successfully fetched review link from ${fetchResult.source}`);
    } else if (placeId && placeId.startsWith('ChIJ')) {
      // Fallback to Place ID
      googleReviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
      console.log(`[QR Code] 🔄 Using fallback: Place ID review link`);
    } else {
      return res.status(404).json({
        error: 'Could not fetch review link from Google',
        message: 'No valid review link or Place ID available'
      });
    }

    // Update the QR code with new review link
    const updatedQR = await supabaseQRCodeService.updateReviewLink(locationId, googleReviewLink);

    // Regenerate public URL with new review link
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` +
      `business=${encodeURIComponent(updatedQR.locationName)}&` +
      `location=${encodeURIComponent(updatedQR.address || '')}&` +
      `placeId=${encodeURIComponent(placeId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;

    // Regenerate QR code
    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    updatedQR.qrCodeUrl = qrCodeUrl;
    updatedQR.qrDataUrl = qrCodeUrl;
    updatedQR.publicReviewUrl = publicReviewUrl;
    updatedQR.code = locationId;
    await supabaseQRCodeService.saveQRCode(updatedQR);

    res.json({
      success: true,
      qrCode: updatedQR,
      reviewLink: googleReviewLink,
      source: fetchResult.source || 'place_id',
      message: 'Review link re-fetched successfully'
    });

  } catch (error) {
    console.error('Error re-fetching review link:', error);
    res.status(500).json({ 
      error: 'Failed to re-fetch review link',
      message: error.message 
    });
  }
});

// Delete QR code
router.delete('/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const deleted = await supabaseQRCodeService.deleteQRCode(locationId);
    
    if (!deleted) {
      return res.status(404).json({ error: 'QR code not found for this location' });
    }
    
    res.json({ 
      success: true,
      message: 'QR code deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting QR code:', error);
    res.status(500).json({ error: 'Failed to delete QR code' });
  }
});

// Get QR code statuses for multiple locations
router.post('/statuses', async (req, res) => {
  try {
    const { locationIds } = req.body;
    
    if (!Array.isArray(locationIds)) {
      return res.status(400).json({ error: 'locationIds must be an array' });
    }

    const statuses = await supabaseQRCodeService.getQRCodeStatuses(locationIds);
    res.json({ statuses });

  } catch (error) {
    console.error('Error fetching QR code statuses:', error);
    res.status(500).json({ error: 'Failed to fetch QR code statuses' });
  }
});

// Helper function to convert Place ID to review link
// Google review link format: https://search.google.com/local/writereview?placeid=PLACE_ID
function convertPlaceIdToGPageLink(placeId) {
  try {
    if (!placeId) {
      return null;
    }
    
    // Use the standard Google review link format with Place ID
    const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
    console.log(`[QR Code] 🔗 Converted Place ID ${placeId} to review link: ${reviewLink}`);
    
    return reviewLink;
  } catch (error) {
    console.error('[QR Code] ❌ Error converting Place ID to review link:', error.message);
    return null;
  }
}

// Helper function to fetch Place ID using Google Places API
async function fetchPlaceIdFromPlacesAPI(businessName, address) {
  // Check if Google Places API key is configured
  const placesApiKey = process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  
  if (!placesApiKey || placesApiKey === 'YOUR_GOOGLE_PLACES_API_KEY_HERE') {
    console.log('[QR Code] ⚠️ Google Places API key not configured, skipping Places API lookup');
    return null;
  }

  try {
    console.log(`[QR Code] 🔍 Looking up Place ID for: ${businessName} ${address || ''}`);
    
    const query = `${businessName} ${address || ''}`.trim();
    const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?input=${encodeURIComponent(query)}&inputtype=textquery&fields=place_id,name&key=${placesApiKey}`;
    
    console.log(`[QR Code] 🌐 Calling Places API: ${url.substring(0, 100)}...`);
    
    const response = await fetch(url);
    const data = await response.json();
    
    console.log(`[QR Code] 📊 Places API response status: ${data.status}`);
    
    if (data.status === 'OK' && data.candidates && data.candidates.length > 0) {
      const placeId = data.candidates[0].place_id;
      const placeName = data.candidates[0].name;
      console.log(`[QR Code] ✅ Found Place ID from Places API: ${placeId} (Name: ${placeName})`);
      return placeId;
    } else if (data.status === 'ZERO_RESULTS') {
      console.log(`[QR Code] ⚠️ Places API found no results for: ${query}`);
      return null;
    } else {
      console.log(`[QR Code] ⚠️ Places API returned status: ${data.status}`);
      if (data.error_message) {
        console.log(`[QR Code] Error message: ${data.error_message}`);
      }
      return null;
    }
  } catch (error) {
    console.error('[QR Code] ❌ Error fetching Place ID from Places API:', error.message);
    return null;
  }
}

// Helper function to fetch Google review link with multiple fallback methods
async function fetchGoogleReviewLink(accountId, locationId, accessToken, businessName, address) {
  console.log(`[QR Code] 🔍 Fetching Google review link for location: ${locationId}`);

  // Method 0: Try Google Places API FIRST (most reliable for Place ID)
  if (businessName) {
    try {
      const placeId = await fetchPlaceIdFromPlacesAPI(businessName, address);
      if (placeId && placeId.startsWith('ChIJ')) {
        // Convert Place ID to g.page format (preferred by user)
        const reviewLink = convertPlaceIdToGPageLink(placeId);
        if (reviewLink) {
          console.log('[QR Code] ✅ Generated g.page review link from Places API Place ID:', reviewLink);
          return { success: true, reviewLink, source: 'places_api_gpage', placeId };
        } else {
          // Fallback to search.google.com format
          const fallbackLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
          console.log('[QR Code] ✅ Using search.google.com format:', fallbackLink);
          return { success: true, reviewLink: fallbackLink, source: 'places_api_search', placeId };
        }
      }
    } catch (error) {
      console.log('[QR Code] Places API failed, trying GMB APIs...');
    }
  }

  // Method 1: Try GMB v4 API
  try {
    const gmb4Url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}?fields=name,locationName,newReviewUrl,metadata`;
    console.log('[QR Code] Method 1: Trying GMB v4 API...');

    const response = await fetch(gmb4Url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.newReviewUrl) {
        console.log('[QR Code] ✅ Found review URL from GMB v4:', data.newReviewUrl);
        return { success: true, reviewLink: data.newReviewUrl, source: 'gmb_v4' };
      }
    }
  } catch (error) {
    console.log('[QR Code] GMB v4 API failed, trying next method...');
  }

  // Method 2: Try Account Management API
  try {
    const locationName = `accounts/${accountId}/locations/${locationId}`;
    const accountMgmtUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}`;
    console.log('[QR Code] Method 2: Trying Account Management API...');

    const response = await fetch(accountMgmtUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      if (data.newReviewUri) {
        console.log('[QR Code] ✅ Found review URI from Account Management API:', data.newReviewUri);
        return { success: true, reviewLink: data.newReviewUri, source: 'account_management' };
      }
    }
  } catch (error) {
    console.log('[QR Code] Account Management API failed, trying next method...');
  }

  // Method 3: Try Business Information API with extended fields
  try {
    const locationName = `locations/${locationId}`;
    const businessInfoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,storefrontAddress,websiteUri,regularHours,metadata,profile,storefrontAddress`;
    console.log('[QR Code] Method 3: Trying Business Information API...');

    const response = await fetch(businessInfoUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      const data = await response.json();
      console.log('[QR Code] Business Info API response:', JSON.stringify(data, null, 2));

      // Priority 1: Check for direct review URI in profile or metadata
      const reviewUri = data.profile?.reviewUri || data.metadata?.newReviewUri || data.newReviewUri;
      if (reviewUri) {
        console.log('[QR Code] ✅ Found direct review URI:', reviewUri);
        return { success: true, reviewLink: reviewUri, source: 'direct_review_uri' };
      }

      // Priority 2: Check websiteUri for g.page or maps link
      if (data.websiteUri) {
        console.log('[QR Code] Found websiteUri:', data.websiteUri);
        
        // If it's already a g.page link, use it directly
        if (data.websiteUri.includes('g.page/r/') && data.websiteUri.includes('/review')) {
          console.log('[QR Code] ✅ Found g.page review link in websiteUri:', data.websiteUri);
          return { success: true, reviewLink: data.websiteUri, source: 'website_gpage' };
        }
        
        // If it's a maps link with CID, convert to g.page format
        if (data.websiteUri.includes('maps.google.com') || data.websiteUri.includes('goo.gl/maps')) {
          const cidMatch = data.websiteUri.match(/cid=(\d+)/);
          if (cidMatch) {
            const cid = cidMatch[1];
            const reviewLink = constructGPageLinkFromCID(cid);
            console.log('[QR Code] ✅ Constructed g.page link from websiteUri CID:', reviewLink);
            return { success: true, reviewLink, source: 'website_cid' };
          }
        }
      }

      // Priority 3: Check metadata for mapsUri or other URI fields
      const mapsUri = data.metadata?.mapsUri || data.mapsUri;
      if (mapsUri) {
        console.log('[QR Code] Found mapsUri:', mapsUri);
        
        // Extract CID from mapsUri
        const cidMatch = mapsUri.match(/cid=(\d+)/);
        if (cidMatch) {
          const cid = cidMatch[1];
          const reviewLink = constructGPageLinkFromCID(cid);
          console.log('[QR Code] ✅ Constructed g.page link from mapsUri CID:', reviewLink);
          return { success: true, reviewLink, source: 'maps_cid' };
        }

        // Extract hex CID from Maps URL format (e.g., 0x398e2f5138510757:0x70a831a7bb280000)
        const hexCidMatch = mapsUri.match(/0x[0-9a-f]+:0x([0-9a-f]+)/i);
        if (hexCidMatch) {
          const hexCid = hexCidMatch[1];
          const decimalCid = BigInt('0x' + hexCid).toString();
          const reviewLink = constructGPageLinkFromCID(decimalCid);
          if (reviewLink) {
            console.log('[QR Code] ✅ Constructed g.page link from hex CID in mapsUri:', reviewLink);
            return { success: true, reviewLink, source: 'maps_hex_cid' };
          }
        }

        // Check for g.page link in mapsUri
        const gpageMatch = mapsUri.match(/g\.page\/r\/([A-Za-z0-9_-]+)/);
        if (gpageMatch) {
          const reviewLink = `https://g.page/r/${gpageMatch[1]}/review`;
          console.log('[QR Code] ✅ Found g.page link in mapsUri:', reviewLink);
          return { success: true, reviewLink, source: 'maps_gpage' };
        }
      }

      // Priority 4: Use Place ID if available
      if (data.metadata?.placeId || data.placeId) {
        const placeId = data.metadata?.placeId || data.placeId;
        if (placeId.startsWith('ChIJ')) {
          const reviewLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
          console.log('[QR Code] ✅ Generated review link from Place ID:', reviewLink);
          return { success: true, reviewLink, source: 'place_id' };
        }
      }
    }
  } catch (error) {
    console.log('[QR Code] Business Information API failed:', error.message);
  }

  // Helper function to construct g.page link from CID
  function constructGPageLinkFromCID(cid) {
    try {
      // Convert CID to hex
      const hexCid = BigInt(cid).toString(16).toUpperCase();
      // Pad to ensure even number of characters
      const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;
      // Convert hex to buffer then to base64url
      const buffer = Buffer.from(paddedHex, 'hex');
      const encodedCid = buffer.toString('base64url');
      return `https://g.page/r/${encodedCid}/review`;
    } catch (error) {
      console.error('[QR Code] Error constructing g.page link from CID:', error);
      return null;
    }
  }

  // All methods failed - return null
  console.log('[QR Code] ⚠️ All methods failed to fetch review link');
  return { success: false, reviewLink: null, source: 'none' };
}

// New endpoint: Generate QR code with automatic review link fetching
router.post('/generate-with-auto-fetch', async (req, res) => {
  try {
    const {
      accountId,
      locationId,
      locationName,
      address,
      placeId,
      accessToken,
      keywords,
      userId,
      gbpAccountId,
      forceRefresh, // NEW: Allow forcing re-fetch of review link
      businessCategory // NEW: Business category from Google Business Profile
    } = req.body;

    if (!locationId || !locationName || !accessToken) {
      return res.status(400).json({
        error: 'Missing required fields: locationId, locationName, accessToken'
      });
    }

    console.log(`[QR Code] 📦 Generating QR code for ${locationName}${forceRefresh ? ' (FORCE REFRESH)' : ''}`);
    console.log(`[QR Code] 📋 Business Category: ${businessCategory || 'not specified'}`);

    // 🔑 Keywords come directly from user input in the QR generation form
    // Keywords are passed in the request body - use them directly
    let finalKeywords = keywords || '';

    console.log(`[QR Code] 🔑 Keywords from request: "${finalKeywords || 'none'}"`);

    // If no keywords provided in request, try to get from user_locations table as fallback
    if (!finalKeywords && userId) {
      try {
        const { createClient } = await import('@supabase/supabase-js');
        const supabaseUrl = process.env.SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        // Try to get keywords from user_locations table (new clean schema)
        const { data: locationData } = await supabase
          .from('user_locations')
          .select('keywords')
          .eq('location_id', locationId)
          .maybeSingle();

        if (locationData?.keywords) {
          finalKeywords = locationData.keywords;
          console.log(`[QR Code] ✅ Found keywords from user_locations: ${finalKeywords}`);
        }
      } catch (error) {
        console.log(`[QR Code] ⚠️ Could not fetch keywords from user_locations: ${error.message}`);
      }
    }

    console.log(`[QR Code] 🔑 Final keywords to save: "${finalKeywords || 'none'}"`);

    // 🔒 SUBSCRIPTION CHECK
    if (userId && gbpAccountId) {
      const accessCheck = await subscriptionGuard.hasValidAccess(userId, gbpAccountId);
      if (!accessCheck.hasAccess) {
        console.log(`[QR Code] ❌ Subscription check failed`);
        return res.status(403).json({
          error: 'Subscription required',
          message: 'Your trial/subscription has expired. Please upgrade to create QR codes.',
          requiresPayment: true
        });
      }
      console.log(`[QR Code] ✅ Subscription validated`);
    }

    // 1. Check if QR code already exists in database
    const existingQR = await supabaseQRCodeService.getQRCode(locationId);
    if (existingQR && existingQR.googleReviewLink && !forceRefresh) {
      console.log(`[QR Code] ♻️ Found existing QR code for ${locationName}, reusing it`);
      return res.json({
        success: true,
        qrCode: existingQR,
        message: 'QR code already exists',
        cached: true
      });
    }
    
    // If forceRefresh is true, we skip the cache and re-fetch
    if (forceRefresh) {
      console.log(`[QR Code] 🔄 Force refresh requested, re-fetching review link...`);
    }

    // 2. Fetch Google review link (with fallbacks)
    let googleReviewLink = null;
    let fetchedPlaceId = placeId;
    
    if (accountId && accessToken) {
      const fetchResult = await fetchGoogleReviewLink(accountId, locationId, accessToken, locationName, address);
      if (fetchResult.success) {
        googleReviewLink = fetchResult.reviewLink;
        // Update placeId if we got one from the fetch
        if (fetchResult.placeId && !fetchedPlaceId) {
          fetchedPlaceId = fetchResult.placeId;
        }
        console.log(`[QR Code] ✅ Fetched review link from ${fetchResult.source}`);
      }
    }

    // 3. Fallback: Generate review link from placeId if available
    if (!googleReviewLink && fetchedPlaceId && fetchedPlaceId.startsWith('ChIJ')) {
      googleReviewLink = `https://search.google.com/local/writereview?placeid=${fetchedPlaceId}`;
      console.log(`[QR Code] 🔄 Using fallback review link from placeId`);
    }

    // 4. Final fallback: Return error if no review link found
    if (!googleReviewLink) {
      console.log(`[QR Code] ❌ No valid review link found for ${locationName}`);
      return res.status(400).json({
        error: 'No review link available',
        message: 'Could not fetch or generate a valid Google review link. Please provide a Place ID or a valid Google Maps URL.',
        suggestion: 'Visit your Google Business Profile to get the review link'
      });
    }

    // 5. Generate public review URL
    const publicReviewUrl = `${config.frontendUrl}/review/${locationId}?` +
      `business=${encodeURIComponent(locationName)}&` +
      `location=${encodeURIComponent(address || '')}&` +
      `placeId=${encodeURIComponent(fetchedPlaceId || '')}&` +
      `googleReviewLink=${encodeURIComponent(googleReviewLink)}` +
      (businessCategory ? `&category=${encodeURIComponent(businessCategory)}` : '');

    // 6. Generate QR code image
    const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
      errorCorrectionLevel: 'M',
      type: 'image/png',
      quality: 0.92,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF',
      },
      width: 512
    });

    // 7. Save to database (both JSON file and Supabase)
    const qrCodeData = {
      locationId,
      locationName,
      address: address || '',
      placeId: fetchedPlaceId || '',
      googleReviewLink,
      keywords: finalKeywords || '', // Use keywords from automation settings
      businessCategory: businessCategory || null, // NEW: Store business category for category-specific reviews
      qrCodeUrl,
      publicReviewUrl,
      userId: userId || 'anonymous',
      createdAt: new Date().toISOString()
    };

    // Save to Supabase database only (no JSON files)
    try {
      await supabaseQRCodeService.saveQRCode({
        code: locationId,
        locationId: locationId,
        locationName: locationName,
        address: address || '',
        userId: userId || 'anonymous',
        placeId: fetchedPlaceId || '',
        qrDataUrl: qrCodeUrl,
        reviewLink: googleReviewLink,
        publicReviewUrl: publicReviewUrl,
        keywords: finalKeywords || '',
        businessCategory: businessCategory || null,
        scans: 0,
        createdAt: new Date().toISOString()
      });
      console.log(`[QR Code] ✅ Saved to Supabase database with keywords: ${finalKeywords || 'none'}`);
    } catch (dbError) {
      console.error(`[QR Code] ⚠️ Failed to save to Supabase:`, dbError.message);
      throw dbError; // Fail the request if database save fails
    }

    console.log(`[QR Code] ✅ QR code generated successfully for ${locationName}`);

    res.json({
      success: true,
      qrCode: qrCodeData,
      message: 'QR code generated successfully',
      cached: false
    });

  } catch (error) {
    console.error('[QR Code] ❌ Error generating QR code:', error);
    res.status(500).json({ 
      error: 'Failed to generate QR code',
      message: error.message 
    });
  }
});

// Debug endpoint: Test fetching review link for a location
router.post('/debug-review-link', async (req, res) => {
  try {
    const { accountId, locationId, accessToken } = req.body;

    if (!accountId || !locationId || !accessToken) {
      return res.status(400).json({
        error: 'Missing required fields: accountId, locationId, accessToken'
      });
    }

    console.log('[QR Code Debug] Testing review link fetch for:', locationId);

    // Try all methods and return all results
    const results = {
      locationId,
      accountId,
      methods: []
    };

    // Method 1: GMB v4
    try {
      const gmb4Url = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}?fields=name,locationName,newReviewUrl,metadata`;
      const response = await fetch(gmb4Url, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        results.methods.push({
          method: 'GMB v4',
          success: true,
          data: data,
          reviewLink: data.newReviewUrl || null
        });
      } else {
        results.methods.push({
          method: 'GMB v4',
          success: false,
          error: await response.text()
        });
      }
    } catch (error) {
      results.methods.push({
        method: 'GMB v4',
        success: false,
        error: error.message
      });
    }

    // Method 2: Account Management API
    try {
      const locationName = `accounts/${accountId}/locations/${locationId}`;
      const accountMgmtUrl = `https://mybusinessaccountmanagement.googleapis.com/v1/${locationName}`;
      const response = await fetch(accountMgmtUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        results.methods.push({
          method: 'Account Management API',
          success: true,
          data: data,
          reviewLink: data.newReviewUri || null
        });
      } else {
        results.methods.push({
          method: 'Account Management API',
          success: false,
          error: await response.text()
        });
      }
    } catch (error) {
      results.methods.push({
        method: 'Account Management API',
        success: false,
        error: error.message
      });
    }

    // Method 3: Business Information API
    try {
      const locationName = `locations/${locationId}`;
      const businessInfoUrl = `https://mybusinessbusinessinformation.googleapis.com/v1/${locationName}?readMask=name,title,storefrontAddress,websiteUri,regularHours,metadata,profile`;
      const response = await fetch(businessInfoUrl, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        results.methods.push({
          method: 'Business Information API',
          success: true,
          data: data,
          reviewLink: data.newReviewUri || data.profile?.reviewUri || data.websiteUri || null,
          metadata: data.metadata,
          profile: data.profile
        });
      } else {
        results.methods.push({
          method: 'Business Information API',
          success: false,
          error: await response.text()
        });
      }
    } catch (error) {
      results.methods.push({
        method: 'Business Information API',
        success: false,
        error: error.message
      });
    }

    res.json({
      success: true,
      results: results
    });

  } catch (error) {
    console.error('[QR Code Debug] Error:', error);
    res.status(500).json({ 
      error: 'Debug failed',
      message: error.message 
    });
  }
});

export default router;