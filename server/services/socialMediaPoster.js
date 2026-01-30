/**
 * Social Media Posting Service
 * Handles posting content to Facebook Pages and Instagram
 */

import connectionPool from '../database/connectionPool.js';

const SOCIAL_CONNECTIONS_TABLE = 'social_connections';

/**
 * Get Supabase client
 */
async function getSupabase() {
  return await connectionPool.getClient();
}

/**
 * Get social connection for a location
 */
async function getSocialConnection(gmailId, locationId) {
  const supabase = await getSupabase();

  const { data, error } = await supabase
    .from(SOCIAL_CONNECTIONS_TABLE)
    .select('*')
    .eq('gmail', gmailId)
    .eq('location_id', locationId)
    .single();

  if (error && error.code !== 'PGRST116') {
    console.error('[SocialMediaPoster] Error fetching connection:', error);
    return null;
  }

  return data;
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
    // Step 1: Create media container
    const createUrl = `https://graph.instagram.com/v18.0/${instagramUserId}/media`;
    const createParams = new URLSearchParams({
      image_url: imageUrl,
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

    // Step 2: Publish the container
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
  console.log('[SocialMediaPoster] Starting social media posting for location:', locationId);

  const results = {
    facebook: null,
    instagram: null
  };

  // Get social connection for this location
  const connection = await getSocialConnection(gmailId, locationId);

  if (!connection) {
    console.log('[SocialMediaPoster] No social connection found for location');
    return results;
  }

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
  if (connection.instagram_enabled && connection.instagram_access_token && connection.instagram_user_id) {
    console.log('[SocialMediaPoster] Instagram is enabled, posting...');
    results.instagram = await postToInstagram(
      connection.instagram_access_token,
      connection.instagram_user_id,
      content,
      imageUrl
    );
  } else {
    console.log('[SocialMediaPoster] Instagram not enabled or missing credentials');
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
