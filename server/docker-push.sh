#!/bin/bash

# Docker Hub push script for LOBAISEO Backend
# Usage: ./docker-push.sh [DOCKER_HUB_USERNAME]

# Set default Docker Hub username (update this with your actual username)
DEFAULT_USERNAME="scale112"
DOCKERHUB_USERNAME="${1:-$DEFAULT_USERNAME}"
IMAGE_NAME="lobaiseo-backend"
TAG="latest"

echo "🐳 Pushing LOBAISEO Backend to Docker Hub..."
echo "📦 Username: $DOCKERHUB_USERNAME"
echo "🏷️  Image: $IMAGE_NAME:$TAG"

# Check if user is logged in to Docker Hub
if ! docker info | grep -q "Username"; then
    echo "❌ Not logged in to Docker Hub!"
    echo "🔑 Please run: docker login"
    exit 1
fi

# Check if local image exists
if ! docker images | grep -q "$IMAGE_NAME.*$TAG"; then
    echo "❌ Local image $IMAGE_NAME:$TAG not found!"
    echo "🏗️  Please build the image first: npm run docker:build"
    exit 1
fi

# Tag the image for Docker Hub
echo "🏷️  Tagging image for Docker Hub..."
docker tag $IMAGE_NAME:$TAG $DOCKERHUB_USERNAME/$IMAGE_NAME:$TAG

if [ $? -ne 0 ]; then
    echo "❌ Failed to tag image!"
    exit 1
fi

# Push to Docker Hub
echo "⬆️  Pushing to Docker Hub..."
docker push $DOCKERHUB_USERNAME/$IMAGE_NAME:$TAG

if [ $? -eq 0 ]; then
    echo "✅ Successfully pushed to Docker Hub!"
    echo "🌐 Image URL: https://hub.docker.com/r/$DOCKERHUB_USERNAME/$IMAGE_NAME"
    echo "📥 Pull command: docker pull $DOCKERHUB_USERNAME/$IMAGE_NAME:$TAG"
    
    # Show image details
    echo "📋 Pushed image details:"
    docker images $DOCKERHUB_USERNAME/$IMAGE_NAME:$TAG
else
    echo "❌ Failed to push to Docker Hub!"
    exit 1
fi