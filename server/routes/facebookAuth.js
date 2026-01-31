import express from 'express';
import connectionPool from '../database/connectionPool.js';

const router = express.Router();

// Facebook App Credentials (Lobaiseo app)
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '1249146140732197';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '45d93dc0766683e68bda46903f33184f';

// Instagram App Credentials (social-lobaiseo-IG - from Instagram API settings)
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '1509002856841560';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || 'bc86ce27a700f29f4c6a080df717bd2c';

// Redirect URIs
const BACKEND_URL = process.env.BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://app.lobaiseo.com';

// Instagram redirect URI - ALWAYS use production URL (hardcoded to avoid any mismatch)
const INSTAGRAM_REDIRECT_URI = 'https://lobaiseo-backend-yjnl.onrender.com/auth/instagram/callback';

const SOCIAL_CONNECTIONS_TABLE = 'social_connections';

// Helper function to get Supabase client
async function getSupabase() {
  return await connectionPool.getClient();
}

/**
 * GET /auth/facebook
 * Initiates Facebook OAuth flow for connecting Facebook Pages
 * Uses public_profile and pages_show_list for listing pages, pages_manage_posts for posting
 */
router.get('/facebook', (req, res) => {
  const { gmailId, locationId, locationName, platform } = req.query;

  if (!gmailId || !locationId || !locationName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: gmailId, locationId, locationName'
    });
  }

  // Store state for callback
  const state = Buffer.from(JSON.stringify({
    gmailId,
    locationId,
    locationName,
    platform: platform || 'facebook',
    timestamp: Date.now()
  })).toString('base64');

  // Facebook OAuth permissions:
  // For now, using only basic permissions until App Review is approved
  // After approval, add: pages_show_list,pages_read_engagement,pages_manage_posts
  const scope = 'public_profile,email';

  const redirectUri = `${BACKEND_URL}/auth/facebook/callback`;

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  console.log('[FacebookAuth] Redirecting to Facebook OAuth with scope:', scope);
  res.redirect(authUrl);
});

/**
 * GET /auth/facebook/manual
 * Manual Facebook Page connection - for when OAuth doesn't work
 * User provides their own Page ID and Page Access Token
 */
router.get('/facebook/manual', async (req, res) => {
  const { gmailId, locationId, locationName, pageId, pageAccessToken, pageName } = req.query;

  if (!gmailId || !locationId || !pageId || !pageAccessToken) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: gmailId, locationId, pageId, pageAccessToken'
    });
  }

  try {
    // Verify the token works by making a test API call
    const verifyUrl = `https://graph.facebook.com/v18.0/${pageId}?fields=id,name&access_token=${pageAccessToken}`;
    const verifyResponse = await fetch(verifyUrl);
    const verifyData = await verifyResponse.json();

    if (verifyData.error) {
      console.error('[FacebookAuth] Manual token verification failed:', verifyData.error);
      return res.status(400).json({
        success: false,
        error: `Invalid token: ${verifyData.error.message}`
      });
    }

    const actualPageName = verifyData.name || pageName || `Page ${pageId}`;
    console.log('[FacebookAuth] Manual connection verified for page:', actualPageName);

    // Save to database
    const supabase = await getSupabase();

    const { data: existing } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('id')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (existing) {
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .update({
          facebook_enabled: true,
          facebook_page_id: pageId,
          facebook_page_name: actualPageName,
          facebook_access_token: pageAccessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .insert({
          gmail: gmailId,
          location_id: locationId,
          location_name: locationName || 'Unknown Location',
          facebook_enabled: true,
          facebook_page_id: pageId,
          facebook_page_name: actualPageName,
          facebook_access_token: pageAccessToken
        });
    }

    console.log('[FacebookAuth] ✅ Facebook Page manually connected:', actualPageName);
    return res.json({
      success: true,
      pageName: actualPageName,
      pageId: pageId
    });

  } catch (error) {
    console.error('[FacebookAuth] Manual connection error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /auth/facebook/callback
 * Handles Facebook OAuth callback
 */
router.get('/facebook/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[FacebookAuth] OAuth error:', error, error_description);
    return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=missing_code_or_state`);
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { gmailId, locationId, locationName } = stateData;

    console.log('[FacebookAuth] Processing callback for:', { gmailId, locationId });

    // Exchange code for access token
    const redirectUri = `${BACKEND_URL}/auth/facebook/callback`;
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&client_secret=${FACEBOOK_APP_SECRET}` +
      `&code=${code}`;

    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error('[FacebookAuth] Token exchange error:', tokenData.error);
      return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(tokenData.error.message)}`);
    }

    const { access_token: userAccessToken } = tokenData;

    // First try to get pages (if we have page permissions after App Review)
    const pagesUrl = `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${userAccessToken}`;
    const pagesResponse = await fetch(pagesUrl);
    const pagesData = await pagesResponse.json();

    let pageId, pageName, pageAccessToken;

    // Check if we got pages (means we have page permissions)
    if (pagesData.data && pagesData.data.length > 0) {
      // Use the first page
      const page = pagesData.data[0];
      pageId = page.id;
      pageName = page.name;
      pageAccessToken = page.access_token;
      console.log('[FacebookAuth] Connected to Facebook Page:', pageName, 'ID:', pageId);
    } else {
      // No page permissions yet - get user profile instead (for App Review demo)
      console.log('[FacebookAuth] No page permissions - using user profile for demo');
      const profileUrl = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${userAccessToken}`;
      const profileResponse = await fetch(profileUrl);
      const profileData = await profileResponse.json();

      if (profileData.error) {
        console.error('[FacebookAuth] Profile fetch error:', profileData.error);
        return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(profileData.error.message)}`);
      }

      pageId = profileData.id;
      pageName = profileData.name + ' (User Profile - Page permissions pending)';
      pageAccessToken = userAccessToken;
      console.log('[FacebookAuth] Connected Facebook User:', profileData.name);
    }

    // Save to database
    const supabase = await getSupabase();

    const { data: existing } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('id')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .update({
          facebook_enabled: true,
          facebook_page_id: pageId,
          facebook_page_name: pageName,
          facebook_access_token: pageAccessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .insert({
          gmail: gmailId,
          location_id: locationId,
          location_name: locationName,
          facebook_enabled: true,
          facebook_page_id: pageId,
          facebook_page_name: pageName,
          facebook_access_token: pageAccessToken
        });
    }

    console.log('[FacebookAuth] ✅ Facebook Page connected successfully');
    res.redirect(`${FRONTEND_URL}/dashboard/social-media?success=facebook_connected&page=${encodeURIComponent(pageName)}`);

  } catch (error) {
    console.error('[FacebookAuth] Callback error:', error);
    res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(error.message)}`);
  }
});

/**
 * GET /auth/instagram
 * Initiates Instagram Business Login OAuth flow (direct Instagram login page)
 */
router.get('/instagram', (req, res) => {
  const { gmailId, locationId, locationName } = req.query;

  if (!gmailId || !locationId || !locationName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required parameters: gmailId, locationId, locationName'
    });
  }

  // Store state for callback
  const state = Buffer.from(JSON.stringify({
    gmailId,
    locationId,
    locationName,
    platform: 'instagram',
    timestamp: Date.now()
  })).toString('base64');

  // Instagram Business Login scopes (matching app configuration)
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments';

  const redirectUri = INSTAGRAM_REDIRECT_URI;

  // Direct Instagram OAuth via www.instagram.com (shows Instagram login page)
  const authUrl = `https://www.instagram.com/oauth/authorize?` +
    `client_id=${INSTAGRAM_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code` +
    `&state=${encodeURIComponent(state)}`;

  console.log('########## INSTAGRAM AUTH v2025_01_30_D ##########');
  console.log('[InstagramAuth] Direct Instagram OAuth');
  console.log('[InstagramAuth] redirect_uri:', redirectUri);
  console.log('[InstagramAuth] App ID:', INSTAGRAM_APP_ID);
  console.log('########## AUTH REDIRECT ##########');
  res.redirect(authUrl);
});

/**
 * GET /auth/instagram/callback
 * Handles Instagram Business Login OAuth callback
 */
router.get('/instagram/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    console.error('[InstagramAuth] OAuth error:', error, error_description);
    return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(error_description || error)}`);
  }

  if (!code || !state) {
    return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=missing_code_or_state`);
  }

  try {
    // Decode state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    const { gmailId, locationId, locationName } = stateData;

    console.log('[InstagramAuth] Processing callback for:', { gmailId, locationId });

    const redirectUri = INSTAGRAM_REDIRECT_URI;

    // Exchange code for Instagram access token (using Instagram's token endpoint)
    const params = new URLSearchParams();
    params.append('client_id', INSTAGRAM_APP_ID);
    params.append('client_secret', INSTAGRAM_APP_SECRET);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);

    console.log('[InstagramAuth] VERSION_2025_01_30_D - Exchanging code for token');

    const tokenResponse = await fetch('https://api.instagram.com/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString()
    });

    const tokenData = await tokenResponse.json();
    console.log('[InstagramAuth] Token response:', JSON.stringify(tokenData, null, 2));

    if (tokenData.error_type || tokenData.error) {
      console.error('[InstagramAuth] Token exchange error:', tokenData);
      const errorMsg = tokenData.error_message || tokenData.error_description || tokenData.error || 'Token exchange failed';
      return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(errorMsg)}`);
    }

    const { access_token: shortLivedToken, user_id: instagramUserId } = tokenData;
    console.log('[InstagramAuth] Got short-lived token for user:', instagramUserId);

    // Exchange for long-lived token
    const longLivedUrl = `https://graph.instagram.com/access_token?` +
      `grant_type=ig_exchange_token` +
      `&client_secret=${INSTAGRAM_APP_SECRET}` +
      `&access_token=${shortLivedToken}`;

    const longLivedResponse = await fetch(longLivedUrl);
    const longLivedData = await longLivedResponse.json();

    const accessToken = longLivedData.access_token || shortLivedToken;
    console.log('[InstagramAuth] Got long-lived token');

    // Get Instagram user profile
    const profileUrl = `https://graph.instagram.com/me?fields=id,username,account_type,name&access_token=${accessToken}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    if (profileData.error) {
      console.error('[InstagramAuth] Profile fetch error:', profileData.error);
      return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(profileData.error.message)}`);
    }

    const instagramUsername = profileData.username || profileData.name || `user_${instagramUserId}`;

    console.log('[InstagramAuth] Connected to Instagram:', instagramUsername);

    // Save to database
    const supabase = await getSupabase();

    const { data: existing } = await supabase
      .from(SOCIAL_CONNECTIONS_TABLE)
      .select('id')
      .eq('gmail', gmailId)
      .eq('location_id', locationId)
      .single();

    if (existing) {
      // Update existing
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .update({
          instagram_enabled: true,
          instagram_user_id: instagramUserId,
          instagram_username: instagramUsername,
          instagram_access_token: accessToken,
          updated_at: new Date().toISOString()
        })
        .eq('id', existing.id);
    } else {
      // Create new
      await supabase
        .from(SOCIAL_CONNECTIONS_TABLE)
        .insert({
          gmail: gmailId,
          location_id: locationId,
          location_name: locationName,
          instagram_enabled: true,
          instagram_user_id: instagramUserId,
          instagram_username: instagramUsername,
          instagram_access_token: accessToken
        });
    }

    console.log('[InstagramAuth] ✅ Instagram connected successfully');
    res.redirect(`${FRONTEND_URL}/dashboard/social-media?success=instagram_connected&username=${encodeURIComponent(instagramUsername)}`);

  } catch (error) {
    console.error('[InstagramAuth] Callback error:', error);
    res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(error.message)}`);
  }
});

export default router;
