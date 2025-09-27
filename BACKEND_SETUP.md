# Backend Setup for Real-Time Google Business Profile Integration

This backend server enables real-time posting to Google Business Profile by handling OAuth authentication and API calls server-side, avoiding CORS issues.

## 🚀 Quick Setup

### 1. Navigate to Server Directory
```bash
cd server
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Configuration
Create a `.env` file in the `server` directory:

```bash
cp env.example .env
```

Edit `.env` with your Google credentials:
```env
# Google OAuth Credentials (from Google Cloud Console)
GOOGLE_CLIENT_ID=your_google_client_id_here
GOOGLE_CLIENT_SECRET=your_google_client_secret_here
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback

# Server Configuration
PORT=5000
NODE_ENV=development

# Frontend URL (for CORS)
FRONTEND_URL=http://localhost:3000
```

### 4. Update Google Cloud Console
Add these redirect URIs to your Google Cloud Console OAuth 2.0 Client:
- `http://localhost:5000/auth/google/callback` (for backend)
- `http://localhost:3000/auth/google/callback` (for frontend)

### 5. Start the Backend Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

### 6. Update Frontend Environment
Add to your frontend `.env.local` file:
```env
VITE_BACKEND_URL=http://localhost:5000
```

## 🧪 Testing

1. **Health Check**: Visit `http://localhost:5000/health`
2. **Start Frontend**: `npm run dev` (in root directory)
3. **Test Integration**: Create a post - it should now post to real Google Business Profile!

## 📊 API Endpoints

- `GET /health` - Health check
- `GET /auth/google/url` - Get OAuth URL
- `POST /auth/google/callback` - Handle OAuth callback
- `GET /api/accounts` - Get business accounts
- `GET /api/accounts/:accountId/locations` - Get locations
- `POST /api/locations/:locationId/posts` - Create post
- `GET /api/locations/:locationId/posts` - Get posts
- `GET /api/locations/:locationId/reviews` - Get reviews
- `PUT /api/locations/:locationId/reviews/:reviewId/reply` - Reply to review

## 🔧 Google Cloud Console Setup

Make sure these APIs are enabled:
- Google Business Profile API
- Google My Business API
- Google+ API (if available)

## 🛡️ Security Notes

- In production, use a proper database instead of in-memory token storage
- Implement user authentication and session management
- Use HTTPS for all OAuth flows
- Consider token encryption for sensitive data

## 🚨 Troubleshooting

1. **CORS Errors**: Ensure `FRONTEND_URL` matches your React app URL
2. **OAuth Errors**: Check redirect URIs in Google Cloud Console
3. **API Errors**: Verify Google Business Profile API is enabled
4. **Token Errors**: Clear localStorage and re-authenticate

## 🎯 What This Enables

✅ **Real Google Business Profile posting**
✅ **No CORS issues**
✅ **Secure token handling**
✅ **Real-time reviews fetching**
✅ **Actual review replies**
✅ **Production-ready architecture**

Your posts will now actually appear on Google Business Profile in real-time!
