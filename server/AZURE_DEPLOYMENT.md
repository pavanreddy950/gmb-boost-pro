# Azure Deployment Guide for LobaiSEO Backend

## Issue Resolution

The backend deployment was failing with "Application Error" because:
1. `.dockerignore` was excluding `.env.azure` file from Docker builds
2. Environment variables were not properly configured
3. Azure App Service requires explicit configuration

## Fixes Applied

1. **Updated `.dockerignore`**: Now includes `.env.azure` file
2. **Improved `config.js`**: Better error handling for missing config files
3. **Updated `Dockerfile`**: Explicitly copies `.env.azure` file

## Deployment Steps

### Option 1: Deploy with Docker (Recommended)

1. **Build the Docker image**:
   ```bash
   cd server
   docker build -t lobaiseo-backend:latest .
   ```

2. **Tag for Azure Container Registry**:
   ```bash
   # Replace with your Azure Container Registry name
   docker tag lobaiseo-backend:latest <your-acr-name>.azurecr.io/lobaiseo-backend:latest
   ```

3. **Login to Azure Container Registry**:
   ```bash
   az acr login --name <your-acr-name>
   ```

4. **Push to Azure Container Registry**:
   ```bash
   docker push <your-acr-name>.azurecr.io/lobaiseo-backend:latest
   ```

5. **Deploy to Azure Web App**:
   ```bash
   az webapp config container set \
     --name pavan-client-backend-bxgdaqhvarfdeuhe \
     --resource-group <your-resource-group> \
     --docker-custom-image-name <your-acr-name>.azurecr.io/lobaiseo-backend:latest \
     --docker-registry-server-url https://<your-acr-name>.azurecr.io
   ```

### Option 2: Quick Deploy (Using existing setup)

1. **Navigate to server directory**:
   ```bash
   cd server
   ```

2. **Build and push using npm scripts**:
   ```bash
   npm run docker:build
   npm run docker:push
   ```

3. **Restart Azure App Service**:
   ```bash
   az webapp restart --name pavan-client-backend-bxgdaqhvarfdeuhe --resource-group <your-resource-group>
   ```

### Option 3: GitHub Actions / Azure DevOps

Set up CI/CD pipeline to automatically deploy on push to main branch.

## Environment Variables Configuration

The backend requires these environment variables. They are already set in `.env.azure`, but you can also set them in Azure App Service for extra security:

### Required Variables:
- `NODE_ENV=production`
- `RUN_MODE=AZURE`
- `PORT=5000`
- `GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com`
- `GOOGLE_CLIENT_SECRET=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`
- `FRONTEND_URL=https://www.app.lobaiseo.com`
- `BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net`
- `GOOGLE_REDIRECT_URI=https://www.app.lobaiseo.com/auth/google/callback`
- `HARDCODED_ACCOUNT_ID=106433552101751461082`

### Database Variables:
- `SUPABASE_URL=https://atxfghdzuokkggexkrnz.supabase.co`
- `SUPABASE_SERVICE_KEY=<from .env.azure>`
- `TOKEN_ENCRYPTION_KEY=<from .env.azure>`

### Payment Variables:
- `RAZORPAY_KEY_ID=rzp_live_RFSzT9EvJ2cwJI`
- `RAZORPAY_KEY_SECRET=<from .env.azure>`
- `RAZORPAY_WEBHOOK_SECRET=gmb_boost_pro_webhook_secret_2024`

### AI Variables:
- `AZURE_OPENAI_ENDPOINT=https://agentplus.openai.azure.com/`
- `AZURE_OPENAI_API_KEY=<from .env.azure>`
- `AZURE_OPENAI_DEPLOYMENT=gpt-4o`
- `AZURE_OPENAI_API_VERSION=2024-02-15-preview`

### Firebase Variables:
- `FIREBASE_PROJECT_ID=gbp-467810-a56e2`

## Setting Environment Variables in Azure Portal

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to your App Service: `pavan-client-backend-bxgdaqhvarfdeuhe`
3. Go to **Configuration** > **Application Settings**
4. Add each environment variable from the list above
5. Click **Save**
6. Restart the App Service

## Verifying Deployment

1. **Check health endpoint**:
   ```bash
   curl https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health
   ```
   Should return: `{"status":"ok","timestamp":"..."}`

2. **Check CORS**:
   ```bash
   curl -I -X OPTIONS https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/api/payment/subscription/status \
     -H "Origin: https://www.app.lobaiseo.com" \
     -H "Access-Control-Request-Method: GET"
   ```
   Should include CORS headers in response.

3. **Check logs**:
   ```bash
   az webapp log tail --name pavan-client-backend-bxgdaqhvarfdeuhe --resource-group <your-resource-group>
   ```

## Troubleshooting

### Application Error (503)
- Check if Docker image built successfully
- Verify all environment variables are set
- Check Azure App Service logs
- Ensure PORT is set to the correct value Azure expects

### CORS Errors
- Verify `FRONTEND_URL` matches your actual frontend URL
- Check that allowed origins in `config.js` include your frontend
- Ensure backend is actually running (not showing Application Error)

### Database Connection Issues
- Verify Supabase credentials
- Check network connectivity from Azure
- Ensure TOKEN_ENCRYPTION_KEY is set correctly

## Current Configuration

- **Frontend**: https://www.app.lobaiseo.com
- **Backend**: https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
- **Region**: Canada Central
- **Container**: Docker-based deployment
