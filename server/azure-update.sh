#!/bin/bash

# Azure App Service Update Script
# This script triggers Azure to pull and deploy the latest Docker image

set -e

echo "🔄 Azure App Service Update"
echo "==========================="
echo ""

APP_NAME="pavan-client-backend-bxgdaqhvarfdeuhe"
DOCKER_IMAGE="scale112/pavan-client-backend:latest"

echo "📋 Configuration:"
echo "   App Name: $APP_NAME"
echo "   Docker Image: $DOCKER_IMAGE"
echo ""

# Option 1: Using Azure CLI (if installed)
if command -v az &> /dev/null; then
    echo "✅ Azure CLI detected"
    echo ""
    echo "🔄 Restarting Azure App Service to pull latest image..."

    if az webapp restart --name "$APP_NAME" --resource-group "<your-resource-group>" 2>&1; then
        echo "✅ App Service restart triggered successfully"
    else
        echo "⚠️ Restart command failed. Make sure you're logged in with: az login"
        echo "⚠️ And replace <your-resource-group> with your actual resource group name"
    fi
else
    echo "⚠️ Azure CLI not installed"
    echo ""
    echo "📝 Manual Steps Required:"
    echo "1. Go to https://portal.azure.com"
    echo "2. Navigate to App Service: $APP_NAME"
    echo "3. Click 'Restart' button"
    echo "4. Wait 2-3 minutes for the new image to be pulled and deployed"
fi

echo ""
echo "⏳ Waiting 30 seconds for deployment to start..."
sleep 30

echo ""
echo "🔍 Testing health endpoint..."
HEALTH_URL="https://${APP_NAME}.canadacentral-01.azurewebsites.net/health"

for i in {1..5}; do
    echo "   Attempt $i/5..."
    if curl -s "$HEALTH_URL" | grep -q "ok"; then
        echo "✅ Backend is responding correctly!"
        echo ""
        echo "🎉 Deployment successful!"
        exit 0
    fi
    sleep 10
done

echo ""
echo "⚠️ Backend not responding yet. This is normal - Azure deployment can take 2-5 minutes."
echo ""
echo "📋 Next steps:"
echo "1. Wait a few more minutes"
echo "2. Check logs: https://portal.azure.com → $APP_NAME → Log stream"
echo "3. Test manually: $HEALTH_URL"
echo ""
