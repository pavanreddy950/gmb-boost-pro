import express from 'express';
import connectionPool from '../database/connectionPool.js';

const router = express.Router();

// Table name for social connections
const SOCIAL_CONNECTIONS_TABLE = 'social_connections';

// Helper function to get Supabase client
async function getSupabase() {
  return await connectionPool.getClient();
}

/**
 * GET /api/social/connections
 * Get all social connections for a user
 */
router.get('/connections', async (req, res) => {
  try {
    const { gmailId } = req.query;

    if (!gmailId) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID is required'
      });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .eq('gmail', gmailId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Social] Error fetching connections:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch connections'
      });
    }

    res.json({
      success: true,
      connections: data || []
    });

  } catch (error) {
    console.error('[Social] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social/connection/:locationId
 * Get social connection for a specific location
 */
router.get('/connection/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { gmailId } = req.query;

    if (!gmailId || !locationId) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID and Location ID are required'
      });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('[Social] Error fetching connection:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch connection'
      });
    }

    res.json({
      success: true,
      connection: data || null
    });

  } catch (error) {
    console.error('[Social] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social/connect
 * Save or update social connection for a location
 */
router.post('/connect', async (req, res) => {
  try {
    const {
      gmailId,
      phoneNumber,
      locationId,
      locationName,
      platform, // 'instagram' or 'facebook'
      // Instagram fields
      instagramUserId,
      instagramUsername,
      instagramAccessToken,
      // Facebook fields
      facebookPageId,
      facebookPageName,
      facebookAccessToken
    } = req.body;

    if (!gmailId || !locationId || !locationName) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID, Location ID, and Location Name are required'
      });
    }

    const supabase = await getSupabase();

    // Check if connection exists
    const { data: existing } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('id')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    let result;

    if (existing) {
      // Update existing connection
      const updateData = {
        updated_at: new Date().toISOString()
      };

      if (platform === 'instagram') {
        updateData.instagram_user_id = instagramUserId;
        updateData.instagram_username = instagramUsername;
        updateData.instagram_access_token = instagramAccessToken;
        updateData.instagram_enabled = true;
      } else if (platform === 'facebook') {
        updateData.facebook_page_id = facebookPageId;
        updateData.facebook_page_name = facebookPageName;
        updateData.facebook_access_token = facebookAccessToken;
        updateData.facebook_enabled = true;
      }

      const { data, error } = await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .update(updateData)
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;

    } else {
      // Create new connection
      const insertData = {
        gmail: gmailId,
        phone_number: phoneNumber || null,
        location_id: locationId,
        location_name: locationName,
        instagram_enabled: platform === 'instagram',
        instagram_user_id: platform === 'instagram' ? instagramUserId : null,
        instagram_username: platform === 'instagram' ? instagramUsername : null,
        instagram_access_token: platform === 'instagram' ? instagramAccessToken : null,
        facebook_enabled: platform === 'facebook',
        facebook_page_id: platform === 'facebook' ? facebookPageId : null,
        facebook_page_name: platform === 'facebook' ? facebookPageName : null,
        facebook_access_token: platform === 'facebook' ? facebookAccessToken : null
      };

      const { data, error } = await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    console.log(`[Social] ✅ Connected ${platform} for location: ${locationName}`);

    res.json({
      success: true,
      connection: result
    });

  } catch (error) {
    console.error('[Social] Error saving connection:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social/disconnect
 * Disconnect a platform for a location
 */
router.post('/disconnect', async (req, res) => {
  try {
    const { gmailId, locationId, platform } = req.body;

    if (!gmailId || !locationId || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID, Location ID, and Platform are required'
      });
    }

    const supabase = await getSupabase();

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (platform === 'instagram') {
      updateData.instagram_enabled = false;
      updateData.instagram_user_id = null;
      updateData.instagram_username = null;
      updateData.instagram_access_token = null;
    } else if (platform === 'facebook') {
      updateData.facebook_enabled = false;
      updateData.facebook_page_id = null;
      updateData.facebook_page_name = null;
      updateData.facebook_access_token = null;
    }

    const { data, error } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .update(updateData)
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .select()
      .single();

    if (error) {
      console.error('[Social] Error disconnecting:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to disconnect'
      });
    }

    console.log(`[Social] 🔌 Disconnected ${platform} for location: ${locationId}`);

    res.json({
      success: true,
      connection: data
    });

  } catch (error) {
    console.error('[Social] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social/toggle
 * Toggle auto-posting for a platform
 */
router.post('/toggle', async (req, res) => {
  try {
    const { gmailId, locationId, platform, enabled } = req.body;

    if (!gmailId || !locationId || !platform || enabled === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID, Location ID, Platform, and Enabled status are required'
      });
    }

    const supabase = await getSupabase();

    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (platform === 'instagram') {
      updateData.instagram_enabled = enabled;
    } else if (platform === 'facebook') {
      updateData.facebook_enabled = enabled;
    }

    const { data, error } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .update(updateData)
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .select()
      .single();

    if (error) {
      console.error('[Social] Error toggling:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to toggle auto-posting'
      });
    }

    console.log(`[Social] 🔄 Toggled ${platform} auto-posting to ${enabled} for location: ${locationId}`);

    res.json({
      success: true,
      connection: data
    });

  } catch (error) {
    console.error('[Social] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/social/enabled-connections/:locationId
 * Get enabled social connections for a location (used during posting)
 */
router.get('/enabled-connections/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { gmailId } = req.query;

    if (!gmailId || !locationId) {
      return res.status(400).json({
        success: false,
        error: 'Gmail ID and Location ID are required'
      });
    }

    const supabase = await getSupabase();
    const { data, error } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('[Social] Error fetching enabled connections:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to fetch connections'
      });
    }

    // Return only enabled platforms
    const enabledPlatforms = {
      instagram: null,
      facebook: null
    };

    if (data) {
      if (data.instagram_enabled && data.instagram_access_token) {
        enabledPlatforms.instagram = {
          userId: data.instagram_user_id,
          username: data.instagram_username,
          accessToken: data.instagram_access_token
        };
      }
      if (data.facebook_enabled && data.facebook_access_token) {
        enabledPlatforms.facebook = {
          pageId: data.facebook_page_id,
          pageName: data.facebook_page_name,
          accessToken: data.facebook_access_token
        };
      }
    }

    res.json({
      success: true,
      platforms: enabledPlatforms
    });

  } catch (error) {
    console.error('[Social] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/social/test-post
 * Test social media posting directly
 */
router.post('/test-post', async (req, res) => {
  try {
    const { locationId, message, imageUrl } = req.body;

    if (!locationId || !message) {
      return res.status(400).json({
        success: false,
        error: 'locationId and message are required'
      });
    }

    console.log('[Social] Test post requested for location:', locationId, 'imageUrl:', imageUrl || 'none');

    // Import the social media poster
    const { postToSocialMedia } = await import('../services/socialMediaPoster.js');

    // Call the posting function
    const results = await postToSocialMedia(null, locationId, message, imageUrl || null);

    console.log('[Social] Test post results:', JSON.stringify(results, null, 2));

    res.json({
      success: true,
      message: 'Test post completed',
      results
    });

  } catch (error) {
    console.error('[Social] Test post error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * GET /api/social/debug/:locationId
 * Debug endpoint to check what connection is stored for a location
 */
router.get('/debug/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { gmailId } = req.query;

    console.log('[Social] Debug lookup for locationId:', locationId, 'gmailId:', gmailId);

    const supabase = await getSupabase();

    // Get all connections to see what's stored
    const { data: allConnections, error: allError } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .order('created_at', { ascending: false });

    if (allError) {
      return res.status(500).json({ error: 'Failed to fetch connections', details: allError });
    }

    // Extract numeric ID
    const numericId = locationId.includes('/') ? locationId.split('/').pop() : locationId;

    // Try different matching strategies
    const exactMatch = allConnections.find(c => c.location_id === locationId);
    const numericMatch = allConnections.find(c => c.location_id === numericId);
    const partialMatch = allConnections.find(c => c.location_id && c.location_id.includes(numericId));
    const reversePartialMatch = allConnections.find(c => c.location_id && numericId.includes(c.location_id));

    // Also use getSocialConnection to test
    const { getSocialConnection } = await import('../services/socialMediaPoster.js');
    const connectionResult = await getSocialConnection(gmailId, locationId);

    res.json({
      success: true,
      debug: {
        inputLocationId: locationId,
        inputGmailId: gmailId,
        numericId: numericId,
        totalConnectionsInDb: allConnections.length,
        allConnectionLocationIds: allConnections.map(c => ({
          id: c.id,
          location_id: c.location_id,
          gmail: c.gmail,
          location_name: c.location_name,
          facebook_enabled: c.facebook_enabled,
          instagram_enabled: c.instagram_enabled
        })),
        matchResults: {
          exactMatch: exactMatch ? { id: exactMatch.id, location_id: exactMatch.location_id } : null,
          numericMatch: numericMatch ? { id: numericMatch.id, location_id: numericMatch.location_id } : null,
          partialMatch: partialMatch ? { id: partialMatch.id, location_id: partialMatch.location_id } : null,
          reversePartialMatch: reversePartialMatch ? { id: reversePartialMatch.id, location_id: reversePartialMatch.location_id } : null
        },
        getSocialConnectionResult: connectionResult ? {
          id: connectionResult.id,
          location_id: connectionResult.location_id,
          gmail: connectionResult.gmail,
          facebook_enabled: connectionResult.facebook_enabled,
          facebook_page_id: connectionResult.facebook_page_id,
          instagram_enabled: connectionResult.instagram_enabled,
          instagram_user_id: connectionResult.instagram_user_id
        } : null
      }
    });

  } catch (error) {
    console.error('[Social] Debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

export default router;
