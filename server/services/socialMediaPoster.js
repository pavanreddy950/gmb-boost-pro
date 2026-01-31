/**
 * Social Media Posting Service
 * Handles posting content to Facebook Pages and Instagram
 */

import connectionPool from '../database/connectionPool.js';
import photoService from './photoService.js';

const SOCIAL_CONNECTIONS_TABLE = 'social_connections';

/**
 * Get Supabase client
 */
async function getSupabase() {
  return await connectionPool.getClient();
}

/**
 * Get social connection for a location
 * Tries multiple formats: full locationId, numeric ID only, and partial matches
 */
async function getSocialConnection(gmailId, locationId) {
  const supabase = await getSupabase();

  console.log('[SocialMediaPoster] Looking for connection - gmailId:', gmailId, 'locationId:', locationId);

  // Extract numeric ID if locationId contains slashes (accounts/123/locations/456 -> 456)
  const numericId = locationId.includes('/') ? locationId.split('/').pop() : locationId;
  console.log('[SocialMediaPoster] Numeric locationId:', numericId);

  // Try 1: Exact match with gmailId + locationId
  if (gmailId) {
    const { data } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (data) {
      console.log('[SocialMediaPoster] Found by gmail + exact locationId');
      return data;
    }
  }

  // Try 2: Exact match with locationId only
  const { data: exactMatch } = await supabase
    .from(SOCIAL_CONNECTIONS_TABLE)
    .select('*')
    .eq('location_id', locationId)
    .single();

  if (exactMatch) {
    console.log('[SocialMediaPoster] Found by exact locationId');
    return exactMatch;
  }

  // Try 3: Match with numeric ID only (for when full path was stored but numeric ID passed)
  if (numericId !== locationId) {
    const { data: numericMatch } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('*')
      .eq('location_id', numericId)
      .single();

    if (numericMatch) {
      console.log('[SocialMediaPoster] Found by numeric locationId');
      return numericMatch;
    }
  }

  // Try 4: Partial match - location_id contains the numeric ID
  console.log('[SocialMediaPoster] Trying partial match with LIKE for:', numericId);
  const { data: partialMatches } = await supabase
    .from(SOCIAL_CONNECTIONS_TABLE)
    .select('*')
    .like('location_id', `%${numericId}%`);

  if (partialMatches && partialMatches.length > 0) {
    console.log('[SocialMediaPoster] Found by partial match, count:', partialMatches.length);
    return partialMatches[0];
  }

  console.log('[SocialMediaPoster] No connection found for location');
  return null;
}

/**
 * Post to Facebook Page
 * @param {string} pageAccessToken - Facebook Page access token
 * @param {string} pageId - Facebook Page ID
 * @param {string} message - Post content
 * @param {string} imageUrl - Optional image URL
 * @returns {Promise<{success: boolean, postId?: string, error?: string}>}
 */
async function postToFacebook(pageAccessToken, pageId, message, imageUrl = null) {
  console.log('[SocialMediaPoster] Posting to Facebook Page:', pageId);

  try {
    let url;
    let body;

    if (imageUrl) {
      // Post with image
      url = `https://graph.facebook.com/v18.0/${pageId}/photos`;
      body = new URLSearchParams({
        message: message,
        url: imageUrl,
        access_token: pageAccessToken
      });
    } else {
      // Text-only post
      url = `https://graph.facebook.com/v18.0/${pageId}/feed`;
      body = new URLSearchParams({
        message: message,
        access_token: pageAccessToken
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    });

    const data = await response.json();

    if (data.error) {
      console.error('[SocialMediaPoster] Facebook API error:', data.error);
      return {
        success: false,
        error: data.error.message || 'Facebook posting failed'
      };
    }

    console.log('[SocialMediaPoster] Facebook post created:', data.id || data.post_id);
    return {
      success: true,
      postId: data.id || data.post_id
    };

  } catch (error) {
    console.error('[SocialMediaPoster] Facebook posting error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Post to Instagram
 * Instagram Content Publishing API requires a 2-step process:
 * 1. Create a media container
 * 2. Publish the container
 *
 * Note: Instagram API requires an image for posts (no text-only posts)
 *
 * @param {string} accessToken - Instagram access token
 * @param {string} instagramUserId - Instagram User ID
 * @param {string} caption - Post caption
 * @param {string} imageUrl - Image URL (required for Instagram)
 * @returns {Promise<{success: boolean, postId?: string, error?: string}>}
 */
async function postToInstagram(accessToken, instagramUserId, caption, imageUrl) {
  console.log('[SocialMediaPoster] Posting to Instagram:', instagramUserId);

  if (!imageUrl) {
    console.log('[SocialMediaPoster] Instagram requires an image, skipping text-only post');
    return {
      success: false,
      error: 'Instagram requires an image for posts'
    };
  }

  try {
    // Step 0: Fix aspect ratio if needed (Instagram requires 0.8 to 1.91)
    console.log('[SocialMediaPoster] Checking/fixing image aspect ratio for Instagram...');
    let processedImageUrl = imageUrl;
    try {
      processedImageUrl = await photoService.fixAspectRatioForInstagram(imageUrl);
      if (processedImageUrl !== imageUrl) {
        console.log('[SocialMediaPoster] Image was padded for Instagram compatibility');
      }
    } catch (aspectError) {
      console.warn('[SocialMediaPoster] Could not fix aspect ratio, using original:', aspectError.message);
    }

    // Step 1: Create media container
    const createUrl = `https://graph.instagram.com/v18.0/${instagramUserId}/media`;
    const createParams = new URLSearchParams({
      image_url: processedImageUrl,
      caption: caption,
      access_token: accessToken
    });

    console.log('[SocialMediaPoster] Creating Instagram media container...');
    const createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: createParams.toString()
    });

    const createData = await createResponse.json();

    if (createData.error) {
      console.error('[SocialMediaPoster] Instagram container creation error:', createData.error);
      return {
        success: false,
        error: createData.error.message || 'Failed to create Instagram media container'
      };
    }

    const containerId = createData.id;
    console.log('[SocialMediaPoster] Instagram container created:', containerId);

    // Step 2: Wait for Instagram to process the media (required by API)
    console.log('[SocialMediaPoster] Waiting for Instagram to process media...');

    // Poll the container status until it's ready (max 30 seconds)
    let mediaReady = false;
    let attempts = 0;
    const maxAttempts = 6; // 6 attempts x 5 seconds = 30 seconds max

    while (!mediaReady && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
      attempts++;

      // Check container status
      const statusUrl = `https://graph.instagram.com/v18.0/${containerId}?fields=status_code&access_token=${accessToken}`;
      const statusResponse = await fetch(statusUrl);
      const statusData = await statusResponse.json();

      console.log(`[SocialMediaPoster] Container status check ${attempts}:`, statusData.status_code || 'checking...');

      if (statusData.status_code === 'FINISHED') {
        mediaReady = true;
      } else if (statusData.status_code === 'ERROR') {
        return {
          success: false,
          error: 'Instagram media processing failed'
        };
      }
    }

    if (!mediaReady) {
      console.log('[SocialMediaPoster] Media processing timeout, attempting publish anyway...');
    }

    // Step 3: Publish the container
    const publishUrl = `https://graph.instagram.com/v18.0/${instagramUserId}/media_publish`;
    const publishParams = new URLSearchParams({
      creation_id: containerId,
      access_token: accessToken
    });

    console.log('[SocialMediaPoster] Publishing Instagram media...');
    const publishResponse = await fetch(publishUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams.toString()
    });

    const publishData = await publishResponse.json();

    if (publishData.error) {
      console.error('[SocialMediaPoster] Instagram publish error:', publishData.error);
      return {
        success: false,
        error: publishData.error.message || 'Failed to publish Instagram post'
      };
    }

    console.log('[SocialMediaPoster] Instagram post published:', publishData.id);
    return {
      success: true,
      postId: publishData.id
    };

  } catch (error) {
    console.error('[SocialMediaPoster] Instagram posting error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Post to all enabled social media platforms for a location
 * @param {string} gmailId - User's gmail ID
 * @param {string} locationId - GBP location ID
 * @param {string} content - Post content/message
 * @param {string} imageUrl - Optional image URL
 * @returns {Promise<{facebook?: object, instagram?: object}>}
 */
async function postToSocialMedia(gmailId, locationId, content, imageUrl = null) {
  console.log('[SocialMediaPoster] ========================================');
  console.log('[SocialMediaPoster] Starting social media posting');
  console.log('[SocialMediaPoster] gmailId:', gmailId);
  console.log('[SocialMediaPoster] locationId:', locationId);
  console.log('[SocialMediaPoster] content length:', content?.length || 0);
  console.log('[SocialMediaPoster] imageUrl:', imageUrl ? 'provided' : 'none');
  console.log('[SocialMediaPoster] ========================================');

  const results = {
    facebook: null,
    instagram: null
  };

  // Get social connection for this location
  const connection = await getSocialConnection(gmailId, locationId);

  if (!connection) {
    console.log('[SocialMediaPoster] ❌ No social connection found for location:', locationId);
    console.log('[SocialMediaPoster] ❌ This means no Facebook/Instagram is linked to this location');
    return results;
  }

  console.log('[SocialMediaPoster] ✅ Found social connection:', {
    id: connection.id,
    location_id: connection.location_id,
    gmail: connection.gmail,
    facebook_enabled: connection.facebook_enabled,
    facebook_page_id: connection.facebook_page_id,
    instagram_enabled: connection.instagram_enabled,
    instagram_user_id: connection.instagram_user_id
  });

  // Post to Facebook if enabled
  if (connection.facebook_enabled && connection.facebook_access_token && connection.facebook_page_id) {
    console.log('[SocialMediaPoster] Facebook is enabled, posting...');
    results.facebook = await postToFacebook(
      connection.facebook_access_token,
      connection.facebook_page_id,
      content,
      imageUrl
    );
  } else {
    console.log('[SocialMediaPoster] Facebook not enabled or missing credentials');
  }

  // Post to Instagram if enabled
  console.log('[SocialMediaPoster] Instagram check:', {
    instagram_enabled: connection.instagram_enabled,
    has_access_token: !!connection.instagram_access_token,
    has_user_id: !!connection.instagram_user_id,
    instagram_user_id: connection.instagram_user_id,
    has_image_url: !!imageUrl
  });

  if (connection.instagram_enabled && connection.instagram_access_token && connection.instagram_user_id) {
    if (!imageUrl) {
      console.log('[SocialMediaPoster] ⚠️ Instagram requires an image but no imageUrl provided');
      results.instagram = { success: false, error: 'Instagram requires an image for posts' };
    } else {
      console.log('[SocialMediaPoster] Instagram is enabled, posting with image:', imageUrl);
      results.instagram = await postToInstagram(
        connection.instagram_access_token,
        connection.instagram_user_id,
        content,
        imageUrl
      );
    }
  } else {
    console.log('[SocialMediaPoster] ❌ Instagram not posting - missing:', {
      enabled: !connection.instagram_enabled ? 'instagram_enabled is false' : 'OK',
      token: !connection.instagram_access_token ? 'instagram_access_token missing' : 'OK',
      userId: !connection.instagram_user_id ? 'instagram_user_id missing' : 'OK'
    });
  }

  console.log('[SocialMediaPoster] Social media posting completed:', {
    facebook: results.facebook?.success || false,
    instagram: results.instagram?.success || false
  });

  return results;
}

/**
 * Check if a location has any social media platforms enabled
 */
async function hasSocialMediaEnabled(gmailId, locationId) {
  const connection = await getSocialConnection(gmailId, locationId);

  if (!connection) return false;

  return (connection.facebook_enabled && connection.facebook_access_token) ||
         (connection.instagram_enabled && connection.instagram_access_token);
}

export {
  postToFacebook,
  postToInstagram,
  postToSocialMedia,
  getSocialConnection,
  hasSocialMediaEnabled
};

export default {
  postToFacebook,
  postToInstagram,
  postToSocialMedia,
  getSocialConnection,
  hasSocialMediaEnabled
};
