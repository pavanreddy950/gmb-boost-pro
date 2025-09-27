# Azure Configuration Documentation

This document preserves all Azure-specific configurations and provides instructions for switching between local and Azure deployment modes.

## Azure Environment Details

### Production URLs
- **Frontend**: `https://polite-wave-08ec8c90f.1.azurestaticapps.net`
- **Backend**: `https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net`

### Azure App Service Environment Variables
- `WEBSITE_HOSTNAME`: `scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net`
- `NODE_ENV`: `production`
- `PORT`: `5000`

### CORS Origins (Azure Mode)
The following origins are allowed in Azure production mode:
```javascript
[
  'https://polite-wave-08ec8c90f.1.azurestaticapps.net',
  'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net',
  process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : null,
]
```

## Configuration Files

### `.env.local` - Local Development
Used for running the backend locally with `npm run dev:local`

### `.env.azure` - Azure Production
Contains all Azure-specific settings for production deployment

## Switching Between Modes

### Run Local Development
```bash
npm run dev:local
```
This will:
- Load `.env.local` configuration
- Set CORS to allow `http://localhost:3000`
- Use local redirect URIs
- Run in development mode

### Run Azure Mode (for testing)
```bash
npm run dev:azure
```
This will:
- Load `.env.azure` configuration
- Set CORS to allow Azure URLs
- Use Azure redirect URIs
- Run in production mode

## Deployment to Azure

### Prerequisites
1. Azure App Service configured
2. Environment variables set in Azure Portal:
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `FRONTEND_URL`
   - `NODE_ENV=production`

### Deployment Steps
1. Switch to Azure configuration: `npm run dev:azure`
2. Test locally to ensure Azure URLs work
3. Deploy using your preferred method (GitHub Actions, Azure CLI, etc.)

### Azure Static Web App Integration
- Frontend URL: `https://polite-wave-08ec8c90f.1.azurestaticapps.net`
- Ensure OAuth redirect URI is configured in Google Cloud Console
- Set environment variables in Azure Static Web Apps configuration

## Original Azure Configurations (Preserved)

### Hardcoded Values from Original server.js
```javascript
// These were hardcoded in the original server.js - Updated URLs
const AZURE_FRONTEND_URL = 'https://polite-wave-08ec8c90f.1.azurestaticapps.net';
const AZURE_BACKEND_URL = 'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net';
const HARDCODED_ACCOUNT_ID = '106433552101751461082';

// Google OAuth Credentials
const GOOGLE_CLIENT_ID = '52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com';
const GOOGLE_CLIENT_SECRET = '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';
```

### Azure CORS Configuration
```javascript
const allowedOrigins = [
  'https://polite-wave-08ec8c90f.1.azurestaticapps.net',
  'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net',
  process.env.WEBSITE_HOSTNAME ? `https://${process.env.WEBSITE_HOSTNAME}` : null,
];
```

## Troubleshooting

### Common Issues
1. **OAuth Redirect Mismatch**: Ensure redirect URIs match between local/Azure modes
2. **CORS Errors**: Check that the frontend URL is included in allowed origins
3. **Environment Variables**: Verify all required variables are set in Azure Portal

### Quick Fixes
- Local OAuth issues: Use `http://localhost:3000/auth/google/callback`
- Azure OAuth issues: Use `https://polite-wave-08ec8c90f.1.azurestaticapps.net/auth/google/callback`
- Missing env vars: Copy from `.env.azure` to Azure App Service configuration

## Restoring Full Azure Configuration

To restore the original Azure setup:
1. Copy settings from `.env.azure`
2. Run `npm run dev:azure` to test
3. Deploy to Azure App Service
4. Verify OAuth redirect URIs in Google Cloud Console

This configuration ensures you can seamlessly switch between local development and Azure production deployment without losing any settings.