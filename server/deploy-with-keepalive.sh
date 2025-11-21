#!/bin/bash

# Deploy Updated Backend with Keep-Alive Service to Azure
# This script builds and pushes the Docker image with the new keep-alive service

set -e  # Exit on any error

echo "🚀 Deploying Backend with Keep-Alive Service to Azure"
echo "=================================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DOCKER_IMAGE="scale112/pavan-client-backend"
TAG="latest"
AZURE_APP_NAME="pavan-client-backend-bxgdaqhvarfdeuhe"

echo -e "${BLUE}Step 1: Building Docker Image${NC}"
echo "Building $DOCKER_IMAGE:$TAG..."
docker build -t $DOCKER_IMAGE:$TAG .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Failed to build Docker image${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 2: Logging into Docker Hub${NC}"
docker login

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Logged into Docker Hub${NC}"
else
    echo -e "${RED}❌ Failed to login to Docker Hub${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Pushing Docker Image${NC}"
echo "Pushing $DOCKER_IMAGE:$TAG..."
docker push $DOCKER_IMAGE:$TAG

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Docker image pushed successfully${NC}"
else
    echo -e "${RED}❌ Failed to push Docker image${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo ""
echo "=================================================="
echo -e "${YELLOW}IMPORTANT NEXT STEPS:${NC}"
echo ""
echo "1. Go to Azure Portal: https://portal.azure.com"
echo "2. Navigate to: $AZURE_APP_NAME"
echo "3. Go to: Deployment Center"
echo "4. Verify image is set to: $DOCKER_IMAGE:$TAG"
echo "5. Click 'Restart' in Overview"
echo "6. Wait 2-3 minutes for container to start"
echo ""
echo "7. CRITICAL: Enable 'Always On'"
echo "   - Configuration → General settings → Always On = On"
echo "   - (Requires Basic tier or higher)"
echo ""
echo "8. Verify deployment:"
echo "   curl https://$AZURE_APP_NAME.canadacentral-01.azurewebsites.net/health"
echo "   curl https://$AZURE_APP_NAME.canadacentral-01.azurewebsites.net/health/keep-alive"
echo ""
echo "=================================================="
echo ""
echo -e "${BLUE}📋 See AUTO_POSTING_FIX_GUIDE.md for complete instructions${NC}"
