# Azure Environment Variables Setup

## 🎯 URGENT: Set These Environment Variables in Azure App Service

Your AI reviews are not working because the Azure OpenAI environment variables are missing from your Azure App Service configuration.

### Step 1: Go to Azure Portal
1. Navigate to https://portal.azure.com
2. Find your App Service: `scale12345-hccmcmf7g3bwbvd0`
3. Go to **Configuration** > **Environment variables**

### Step 2: Add These Environment Variables

Click "New application setting" for each of these:

```
Name: AZURE_OPENAI_ENDPOINT
Value: https://agentplus.openai.azure.com/
```

```
Name: AZURE_OPENAI_API_KEY  
Value: 1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia
```

```
Name: AZURE_OPENAI_DEPLOYMENT
Value: gpt-4o
```

```
Name: AZURE_OPENAI_API_VERSION
Value: 2024-02-15-preview
```

### Step 3: Save and Restart
1. Click **Save** at the top
2. Wait for the configuration to save
3. Click **Restart** to restart your App Service

### Step 4: Verify
After restart, test your AI reviews at:
- Go to "Ask for Reviews" page
- The AI-generated reviews should now load properly

## ⚠️ Important Notes:
- These credentials are already configured in your local `.env.azure` file
- The Azure App Service just needs them set as environment variables
- Without these, ALL AI features (reviews, auto-posting, auto-replies) will fail
- The restart is required for the new environment variables to take effect

## 🔍 Verification Commands:
After setting up, you can test with:
```bash
curl -X POST "https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net/api/ai-reviews/generate" \
  -H "Content-Type: application/json" \
  -d '{"businessName":"Test Business","location":"Test City","businessType":"restaurant"}'
```

This should return AI-generated reviews instead of an error.