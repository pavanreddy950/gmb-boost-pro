#!/bin/bash
# Script to update Azure Web App to use new Docker image

# Configuration
RESOURCE_GROUP="your-resource-group-name"  # Update this
APP_NAME="pavan-client-backend"
DOCKER_IMAGE="scale112/pavan-client-backend:latest"

echo "======================================="
echo "  Updating Azure Web App Container"
echo "======================================="
echo ""
echo "App Name: $APP_NAME"
echo "New Image: $DOCKER_IMAGE"
echo ""

# Update container image
echo "Step 1: Updating container image..."
az webapp config container set \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --docker-custom-image-name $DOCKER_IMAGE \
  --docker-registry-server-url https://index.docker.io

if [ $? -eq 0 ]; then
  echo "✅ Container image updated successfully"
else
  echo "❌ Failed to update container image"
  exit 1
fi

echo ""
echo "Step 2: Restarting app service..."
az webapp restart \
  --name $APP_NAME \
  --resource-group $RESOURCE_GROUP

if [ $? -eq 0 ]; then
  echo "✅ App service restarted successfully"
else
  echo "❌ Failed to restart app service"
  exit 1
fi

echo ""
echo "Step 3: Waiting for app to start (30 seconds)..."
sleep 30

echo ""
echo "Step 4: Checking health endpoint..."
curl -s https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net/health

echo ""
echo ""
echo "======================================="
echo "  Update Complete!"
echo "======================================="
echo ""
echo "Next steps:"
echo "1. Check logs in Azure Portal → Log Stream"
echo "2. Look for: [AutomationScheduler] messages"
echo "3. Test automation by setting up a test post"
echo ""
