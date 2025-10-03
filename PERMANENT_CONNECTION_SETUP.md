# Permanent Google Business Profile Connection - Instagram-Style

## What Was Changed

Your Google Business Profile connection now works like Instagram - **once you connect, you stay connected forever** until you manually disconnect.

### Key Changes Made:

1. **Backend OAuth Flow (Not Popup)**
   - Changed from unreliable popup OAuth to backend OAuth flow
   - Backend OAuth **always gets refresh tokens** with `access_type: 'offline'`
   - Refresh tokens allow automatic renewal without user interaction

2. **Aggressive Token Refresh**
   - Tokens now refresh **30 minutes before expiry** (not 5 minutes)
   - Auto-refresh runs **every 10 minutes** (not 15 minutes)
   - 5 retry attempts with exponential backoff (not 3)

3. **Permanent Storage**
   - Tokens stored in both **localStorage** (fast) and **Firestore** (permanent)
   - Backend saves tokens to Firestore with refresh tokens
   - On app restart, tokens are loaded from Firestore automatically

4. **Connection Flow**
   - Click "Connect" → Opens Google OAuth in popup
   - Google redirects to `/auth/google/callback`
   - Frontend callback sends code to backend
   - Backend exchanges code for tokens (including refresh token)
   - Backend saves to Firestore
   - Frontend stores tokens locally
   - Popup closes - **you're permanently connected**

## How It Works

### Initial Connection
1. User clicks "Connect Google Business Profile"
2. Backend generates OAuth URL with `access_type: 'offline'` and `prompt: 'consent'`
3. User authorizes in popup
4. Google redirects to frontend callback page with authorization code
5. Frontend sends code to backend
6. Backend exchanges code for **access token + refresh token**
7. Backend saves both tokens to Firestore
8. Frontend stores tokens in localStorage
9. Connection is now **permanent**

### Automatic Token Refresh (Happens in Background)
1. Every 10 minutes, system checks token expiry
2. If token expires in < 30 minutes, it refreshes automatically
3. Uses refresh token to get new access token
4. Updates both localStorage and Firestore
5. **User never sees disconnection**

### On App Restart
1. App loads tokens from localStorage (fast)
2. Simultaneously syncs with Firestore in background
3. If localStorage is empty, loads from Firestore
4. If tokens are expired, automatically refreshes using refresh token
5. **User stays connected across sessions**

### Connection Monitoring
- Proactive health checks every 10 minutes
- Automatic recovery from network issues
- 5 retry attempts before giving up
- Fallback to stored tokens if refresh fails

## Configuration Required

### Google Cloud Console
Your OAuth redirect URI **MUST** be configured:

**Production:**
- Redirect URI: `https://www.app.lobaiseo.com/auth/google/callback`

**Local Development:**
- Redirect URI: `http://localhost:3000/auth/google/callback`

### Environment Variables (Already Set)
```bash
# Production
GOOGLE_REDIRECT_URI=https://www.app.lobaiseo.com/auth/google/callback
GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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

# Backend saves to Firestore automatically
FIREBASE_PROJECT_ID=gbp-467810-a56e2
```

## Testing the Permanent Connection

1. **Initial Connection:**
   - Go to Settings → Connections
   - Click "Connect Google Business Profile"
   - Authorize in popup
   - Popup closes automatically
   - You should see "Connected" status

2. **Test Persistence (Close Browser):**
   - Close browser completely
   - Reopen app
   - You should **still be connected** without logging in again

3. **Test Token Refresh:**
   - Open browser console
   - Look for logs like "Token refreshed successfully - connection remains permanent"
   - Should see automatic refresh every ~30-50 minutes

4. **Test Network Recovery:**
   - Disconnect internet briefly
   - Reconnect internet
   - App should auto-recover using stored tokens

## What the User Sees

- **Initial Connect:** Click button → Google popup → Done
- **Forever Connected:** Never needs to reconnect again
- **Silent Refresh:** Token refreshes happen silently in background
- **No Interruptions:** Can use app continuously without auth prompts
- **Survives Restarts:** Close/reopen app → still connected

## Only Disconnects When:

1. User clicks "Disconnect" in Settings (manual)
2. User revokes access from Google Account settings
3. Refresh token becomes invalid (very rare - usually after 6 months of no use)

## Files Modified

1. `server/server.js` - Backend OAuth with refresh token
2. `src/lib/googleBusinessProfile.ts` - Backend OAuth flow
3. `src/pages/GoogleOAuthCallback.tsx` - Handle OAuth callback
4. `src/hooks/useGoogleBusinessProfile.ts` - Aggressive refresh logic
5. `server/services/firestoreTokenStorage.js` - Already has refresh token support
6. `server/services/tokenStorage.js` - Already has refresh token support

## Result

✅ **Permanent connection like Instagram**
✅ **Automatic token refresh every 10 minutes**
✅ **Survives app restarts**
✅ **Recovers from network issues**
✅ **No user intervention needed**

Your users will now connect once and **stay connected forever** until they manually disconnect!
