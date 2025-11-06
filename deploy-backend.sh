#!/bin/bash

# Backend Deployment Script for Azure
# This script builds and pushes ONLY the backend Docker image

set -e  # Exit on any error

echo "========================================="
echo "🚀 BACKEND DEPLOYMENT TO DOCKER HUB"
echo "========================================="
echo ""

# Configuration
DOCKER_REPO="scale112/pavan-client-backend"
TAG="latest"
FULL_IMAGE="$DOCKER_REPO:$TAG"

echo "📦 Docker Image: $FULL_IMAGE"
echo "📁 Build Context: ./server"
echo ""

# Step 1: Navigate to project root
cd "$(dirname "$0")"
echo "✅ Working directory: $(pwd)"
echo ""

# Step 2: Verify environment is in AZURE mode
echo "🔍 Checking environment configuration..."
if [ ! -f "server/.env" ]; then
    echo "❌ ERROR: server/.env file not found!"
    echo "Please run: npm run switch:azure"
    exit 1
fi

# Check if .env contains AZURE mode
if grep -q "RUN_MODE=AZURE" server/.env; then
    echo "✅ Environment is in AZURE mode"
else
    echo "⚠️  WARNING: server/.env might not be in AZURE mode"
    echo "Current RUN_MODE:"
    grep "RUN_MODE" server/.env || echo "RUN_MODE not set"
    echo ""
    read -p "Continue anyway? (y/N): " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
fi
echo ""

# Step 3: Verify Dockerfile exists
if [ ! -f "server/Dockerfile" ]; then
    echo "❌ ERROR: server/Dockerfile not found!"
    exit 1
fi
echo "✅ Dockerfile found"
echo ""

# Step 4: Check Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ ERROR: Docker is not running!"
    echo "Please start Docker Desktop and try again"
    exit 1
fi
echo "✅ Docker is running"
echo ""

# Step 5: Build the Docker image
echo "========================================="
echo "🔨 BUILDING DOCKER IMAGE"
echo "========================================="
echo ""
cd server
docker build -t "$FULL_IMAGE" -f Dockerfile .
echo ""
echo "✅ Docker image built successfully"
echo ""

# Step 6: Check Docker Hub login
echo "========================================="
echo "🔐 DOCKER HUB AUTHENTICATION"
echo "========================================="
echo ""
if docker info 2>&1 | grep -q "Username"; then
    echo "✅ Already logged in to Docker Hub"
else
    echo "⚠️  Not logged in to Docker Hub"
    echo "Please login:"
    docker login
fi
echo ""

# Step 7: Push to Docker Hub
echo "========================================="
echo "📤 PUSHING TO DOCKER HUB"
echo "========================================="
echo ""
docker push "$FULL_IMAGE"
echo ""
echo "✅ Successfully pushed to Docker Hub: $FULL_IMAGE"
echo ""

# Step 8: Completion message
echo "========================================="
echo "✅ DEPLOYMENT COMPLETE"
echo "========================================="
echo ""
echo "Next steps:"
echo "1. Go to Azure Portal: https://portal.azure.com"
echo "2. Navigate to: App Services > pavan-client-backend-bxgdaqhvarfdeuhe"
echo "3. Click 'Restart' button at the top"
echo "4. Wait 3-5 minutes for the service to pull the new image"
echo "5. Test your application at: https://www.app.lobaiseo.com"
echo ""
echo "🔍 Azure Deployment Center should be configured with:"
echo "   Source: Docker Hub"
echo "   Image: $FULL_IMAGE"
echo "   Continuous Deployment: ON"
echo ""
