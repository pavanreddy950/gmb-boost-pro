import express from 'express';
import connectionPool from '../database/connectionPool.js';

const router = express.Router();

// Facebook App Credentials (Lobaiseo app)
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || '1249146140732197';
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || '45d93dc0766683e68bda46903f33184f';

// Instagram App Credentials (social-lobaiseo app)
const INSTAGRAM_APP_ID = process.env.INSTAGRAM_APP_ID || '1608151443861785';
const INSTAGRAM_APP_SECRET = process.env.INSTAGRAM_APP_SECRET || 'b8430b4adb612830fa59616f9ea99b45';

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

  // Facebook OAuth - basic permissions only (no App Review needed)
  const scope = 'email';

  const redirectUri = `${BACKEND_URL}/auth/facebook/callback`;

  const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
    `client_id=${FACEBOOK_APP_ID}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(scope)}` +
    `&response_type=code`;

  console.log('[FacebookAuth] Redirecting to Facebook OAuth:', authUrl);
  res.redirect(authUrl);
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

    // Get user profile info
    const profileUrl = `https://graph.facebook.com/v18.0/me?fields=id,name&access_token=${userAccessToken}`;
    const profileResponse = await fetch(profileUrl);
    const profileData = await profileResponse.json();

    if (profileData.error) {
      console.error('[FacebookAuth] Profile fetch error:', profileData.error);
      return res.redirect(`${FRONTEND_URL}/dashboard/social-media?error=${encodeURIComponent(profileData.error.message)}`);
    }

    const pageId = profileData.id;
    const pageName = profileData.name;
    const pageAccessToken = userAccessToken;

    console.log('[FacebookAuth] Connected to Facebook Page:', pageName);

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

  // Instagram Business Login scopes
  const scope = 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments';

  const redirectUri = INSTAGRAM_REDIRECT_URI;

  // Direct Instagram OAuth - shows Instagram login page
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
