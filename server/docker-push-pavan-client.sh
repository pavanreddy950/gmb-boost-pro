#!/bin/bash

# Pavan Client Docker Hub Push Script
# This script pushes the pavan-client container to Docker Hub

set -e  # Exit on any error

echo "🚀 Pavan Client Docker Hub Push"
echo "================================"

# Docker Hub configuration
DOCKER_USERNAME="scale112"
IMAGE_NAME="pavan-client-backend"
DOCKER_REPO="$DOCKER_USERNAME/$IMAGE_NAME"

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if image exists
if ! docker images | grep -q "pavan-client-backend"; then
    echo "❌ pavan-client-backend image not found. Please build it first."
    echo "Run: docker-compose -f docker-compose.pavan-client.yml build"
    exit 1
fi

echo "📋 Current pavan-client images:"
docker images | grep pavan-client

# Function to push with error handling
push_image() {
    local tag=$1
    local full_name="$DOCKER_REPO:$tag"
    
    echo "📤 Pushing $full_name..."
    if docker push "$full_name"; then
        echo "✅ Successfully pushed $full_name"
        return 0
    else
        echo "❌ Failed to push $full_name"
        return 1
    fi
}

# Main push process
echo ""
echo "🔍 Checking Docker Hub authentication..."
if ! docker info | grep -q "Username"; then
    echo "⚠️ Not logged in to Docker Hub. Please run:"
    echo "   docker login"
    echo ""
    read -p "Do you want to login now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker login
    else
        echo "❌ Cannot push without Docker Hub authentication"
        exit 1
    fi
fi

echo ""
echo "🏷️ Available tags to push:"
docker images | grep scale112/pavan-client-backend || echo "No tagged images found"

echo ""
echo "📤 Starting push process..."

# Push latest tag
if push_image "latest"; then
    PUSHED_LATEST=true
else
    PUSHED_LATEST=false
fi

# Push versioned tag if it exists
if docker images | grep -q "scale112/pavan-client-backend.*v1.0.0"; then
    if push_image "v1.0.0"; then
        PUSHED_VERSION=true
    else
        PUSHED_VERSION=false
    fi
else
    PUSHED_VERSION=false
fi

# Summary
echo ""
echo "📊 Push Summary:"
echo "================"
if [ "$PUSHED_LATEST" = true ]; then
    echo "✅ Latest tag pushed successfully"
else
    echo "❌ Latest tag push failed"
fi

if [ "$PUSHED_VERSION" = true ]; then
    echo "✅ Version v1.0.0 tag pushed successfully"
elif docker images | grep -q "scale112/pavan-client-backend.*v1.0.0"; then
    echo "❌ Version v1.0.0 tag push failed"
fi

echo ""
echo "🌐 Docker Hub Repository: https://hub.docker.com/r/$DOCKER_USERNAME/$IMAGE_NAME"
echo ""
echo "📋 To pull this container:"
echo "   docker pull $DOCKER_REPO:latest"
echo "   # or"
echo "   docker pull $DOCKER_REPO:v1.0.0"
echo ""
echo "🚀 To run this container:"
echo "   docker run -d -p 5000:5000 --name pavan-client $DOCKER_REPO:latest"
echo ""

if [ "$PUSHED_LATEST" = true ] || [ "$PUSHED_VERSION" = true ]; then
    echo "🎉 Push completed successfully!"
    exit 0
else
    echo "❌ Push failed"
    exit 1
fi