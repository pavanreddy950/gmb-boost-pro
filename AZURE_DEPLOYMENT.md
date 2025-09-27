# Azure Production Deployment Guide for LOBAISEO

## 🎯 Latest Updates (September 2025)

### ✅ Fixed Issues:
1. **CORS errors resolved** - Enhanced CORS configuration with detailed debugging
2. **Payment system enhanced** - Better error handling and validation
3. **Autoposting system overhauled** - Modern Google APIs, token refresh, secure encryption
4. **Environment variable handling improved** - Better error messages and deployment guidance

### 📦 Current Docker Image: `scale112/gmb-boost-pro-backend:latest`

## Backend Deployment (Azure App Service)

### 1. Environment Variables to Set in Azure:
```
GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
GOOGLE_REDIRECT_URI=https://your-frontend-url.com/auth/google/callback
NODE_ENV=production
PORT=5000

# Razorpay
RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI
RAZORPAY_KEY_SECRET=7i0iikfS6eO7w4DSLXldCBX5
RAZORPAY_WEBHOOK_SECRET=gmb_boost_pro_webhook_secret_2024

# Azure OpenAI (REQUIRED for AI reviews and automation)
AZURE_OPENAI_ENDPOINT=https://agentplus.openai.azure.com/
AZURE_OPENAI_API_KEY=1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia
AZURE_OPENAI_DEPLOYMENT=gpt-4o
AZURE_OPENAI_API_VERSION=2024-02-15-preview
```

### 2. Deploy Backend to Azure:
```bash
# Build and deploy
cd server
npm install --production
```

### 3. Update CORS in server.js:
Make sure your frontend domain is in the allowed origins list.

## Frontend Deployment

### 1. Build for Production:
```bash
npm run build
```

### 2. Environment Variables:
The `.env.local` file should have:
```
VITE_BACKEND_URL=https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net
```

### 3. Deploy the `dist` folder to your hosting service

## Google Cloud Console Setup

### Update OAuth 2.0 Redirect URIs:
1. Go to Google Cloud Console
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Add these redirect URIs:
   - `https://your-frontend-url.com/auth/google/callback`
   - `https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net/auth/google/callback`

## Firebase Configuration

Update Firebase authorized domains:
1. Go to Firebase Console
2. Authentication > Settings > Authorized domains
3. Add your production domain

## Testing After Deployment

1. Test Google Business Profile connection
2. Test review QR code generation
3. Test AI review suggestions
4. Test payment flow
5. Test auto-posting features

## Troubleshooting

### If reviews are not loading:
- Check Azure OpenAI credentials in environment variables
- Check backend logs for API errors
- Verify CORS settings

### If business profiles load slowly:
- Check Google API quotas
- Implement caching for business data
- Add pagination for locations

### If CORS errors occur:
- Update allowed origins in server.js
- Ensure frontend URL is correctly set in backend env vars