# Google Business Profile Integration Setup Guide

This guide will help you set up the Google Business Profile integration for your LOBAISEO application, just like Pabbly Connect.

## 🎯 What We've Built

✅ **Seamless Connection Flow** - Clients connect without dealing with APIs  
✅ **Real-time Profile Loading** - All business locations load automatically  
✅ **Multi-location Support** - Handle businesses with multiple locations  
✅ **Account & Location Selection** - Choose specific accounts and locations  
✅ **Professional UI** - Clean interface matching Pabbly Connect style  
✅ **Error Handling** - User-friendly error messages and retry options  

## 🔧 Prerequisites

1. **Google Cloud Console Project** with these APIs enabled:
   - Google My Business API
   - Google My Business Business Information API
   - Google My Business Posts API (if available)

2. **OAuth 2.0 Credentials** configured for web application

## 📋 Step 1: Google Cloud Console Setup

### 1.1 Create/Select Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project `gbp-467810-a56e2` or create a new one
3. Enable billing (required for Google Business APIs)

### 1.2 Enable Required APIs
```bash
# Navigate to APIs & Services > Library and enable:
- Google My Business API
- Google My Business Business Information API  
- Google My Business Account Management API
```

### 1.3 Create OAuth 2.0 Credentials
1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS > OAuth 2.0 Client IDs**
3. Choose **Web application**
4. Add these authorized redirect URIs:
   ```
   http://localhost:8081/auth/google/callback
   https://yourdomain.com/auth/google/callback
   ```
5. Save and copy the **Client ID** and **Client Secret**

### 1.4 Configure OAuth Consent Screen
1. Go to **APIs & Services > OAuth consent screen**
2. Choose **External** user type
3. Fill in required fields:
   - App name: "LOBAISEO"
   - User support email: your-email@domain.com
   - Developer contact: your-email@domain.com
4. Add scopes:
   ```
   https://www.googleapis.com/auth/business.manage
   https://www.googleapis.com/auth/plus.business.manage
   ```
5. Add test users (for testing phase)

## 📋 Step 2: Environment Configuration

Create a `.env.local` file in your project root:

```env
# Google OAuth Credentials
VITE_GOOGLE_CLIENT_ID=your-google-client-id-here
VITE_GOOGLE_CLIENT_SECRET=your-google-client-secret-here

# Firebase Config (already set)
VITE_FIREBASE_API_KEY=AIzaSyCwe2lgsK5rhHePnsVgNflZf68M35qm3wU
VITE_FIREBASE_AUTH_DOMAIN=gbp-467810-a56e2.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=gbp-467810-a56e2
VITE_FIREBASE_STORAGE_BUCKET=gbp-467810-a56e2.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1027867101
VITE_FIREBASE_APP_ID=1:1027867101:web:e5a55b106f9238eb72b634
```

## 📋 Step 3: Update Google Business Profile Service

Update `src/lib/googleBusinessProfile.ts` to use environment variables:

```typescript
this.oauth2Client = new google.auth.OAuth2(
  import.meta.env.VITE_GOOGLE_CLIENT_ID,
  import.meta.env.VITE_GOOGLE_CLIENT_SECRET,
  `${window.location.origin}/auth/google/callback`
);
```

## 🚀 Features Implemented

### 🔗 Connection Flow (Like Pabbly Connect)
- **One-click connection** to Google Business Profile
- **Popup-based OAuth** for seamless user experience  
- **Automatic token management** and refresh
- **Connection status indicators** with visual feedback

### 🏢 Multi-Account & Location Support
- **Account Selection**: Choose from multiple Google Business accounts
- **Location Selection**: Pick specific business locations
- **Real-time Loading**: Profiles load automatically after connection
- **Location Details**: Address, phone, website, categories display

### 📊 Business Profile Management
- **Profile Information**: Complete business details
- **Category Display**: Business categories with badges
- **Status Indicators**: Suspended/duplicate location warnings
- **Metadata Support**: Location permissions and capabilities

### 🔄 Real-time Synchronization
- **Automatic Sync**: Profiles sync on connection
- **Manual Refresh**: Force refresh option available
- **Error Handling**: Graceful error recovery
- **Loading States**: Visual feedback during operations

## 🎨 User Interface Features

### Connection Setup Component
```typescript
// Located at: src/components/GoogleBusinessProfile/ConnectionSetup.tsx
- Clean, professional design matching Pabbly Connect
- Step-by-step connection flow
- Visual connection status
- Account and location selection
- Error handling with retry options
```

### Settings Integration
```typescript
// Located at: src/pages/Settings.tsx
- Tabbed interface (Connections, Notifications, Account, Data)
- Google Business Profile in Connections tab
- Real-time connection status
- Disconnect functionality
```

## 🔧 API Integration Points

### Available Methods
```typescript
// Connection Management
googleBusinessProfileService.generateAuthUrl()
googleBusinessProfileService.handleOAuthCallback(code)
googleBusinessProfileService.loadStoredTokens()
googleBusinessProfileService.disconnect()

// Data Retrieval
googleBusinessProfileService.getBusinessAccounts()
googleBusinessProfileService.getAccountLocations(accountName)
googleBusinessProfileService.getLocationPosts(locationName)
googleBusinessProfileService.getLocationReviews(locationName)

// Content Management
googleBusinessProfileService.createLocationPost(locationName, postData)
```

### React Hook Usage
```typescript
const {
  isConnected,
  isLoading,
  accounts,
  selectedAccount,
  selectedLocation,
  connectGoogleBusiness,
  disconnectGoogleBusiness,
  selectAccount,
  selectLocation,
  refreshAccounts
} = useGoogleBusinessProfile();
```

## 🧪 Testing Your Integration

### 1. Test the Connection Flow
1. Start your dev server: `npm run dev`
2. Navigate to: `http://localhost:8081/dashboard/settings`
3. Click on the **Connections** tab
4. Click **Connect Google Business Profile**
5. Complete OAuth flow in popup
6. Verify accounts and locations load

### 2. Test Account Selection
1. Select different business accounts
2. Verify locations update accordingly
3. Test location selection
4. Check selected location summary

### 3. Test Disconnection
1. Use the disconnect button
2. Verify connection status updates
3. Confirm tokens are cleared
4. Test reconnection flow

## 🚨 Troubleshooting

### Common Issues

1. **"OAuth Error: invalid_client"**
   - Check Client ID and Secret in environment variables
   - Verify redirect URI matches exactly

2. **"Access blocked: This app's request is invalid"**
   - Configure OAuth consent screen
   - Add your email as a test user

3. **"Insufficient permissions"**
   - Ensure Google My Business APIs are enabled
   - Check OAuth scopes are correct

4. **"No business accounts found"**
   - User might not have Google Business Profile
   - Check API permissions and scopes

5. **Popup blocked**
   - Allow popups for your domain
   - Use alternative redirect flow if needed

### Debug Mode
Enable debug logging by adding to console:
```javascript
localStorage.setItem('debug', 'google-business:*');
```

## 🔒 Security Considerations

### Token Storage
- Tokens are stored in localStorage (consider encryption for production)
- Automatic token refresh implemented
- Secure token revocation on disconnect

### API Security
- All API calls use OAuth 2.0
- Scopes limited to necessary permissions
- Error messages don't expose sensitive data

## 🚀 Production Deployment

### Environment Variables
Set these in your production environment:
```env
VITE_GOOGLE_CLIENT_ID=your-production-client-id
VITE_GOOGLE_CLIENT_SECRET=your-production-client-secret
```

### OAuth Consent Screen
1. Submit for verification if serving external users
2. Add production domains to authorized origins
3. Update redirect URIs for production URLs

### Domain Configuration
Update redirect URIs in Google Cloud Console:
```
https://yourdomain.com/auth/google/callback
```

## 📈 Next Steps

### Webhook Integration (Future)
- Set up webhooks for real-time updates
- Handle business profile changes
- Implement review notifications

### Advanced Features
- Bulk post scheduling
- Advanced analytics
- Review response automation
- Multi-user account management

## 🎉 Success!

Your Google Business Profile integration is now complete! Clients can:

✅ **Connect seamlessly** without API knowledge  
✅ **See all their business profiles** automatically  
✅ **Select specific locations** to manage  
✅ **Get real-time synchronization**  
✅ **Manage everything from one dashboard**  

This provides the same professional experience as Pabbly Connect, making it easy for clients to connect their Google Business Profiles without technical complexity.

