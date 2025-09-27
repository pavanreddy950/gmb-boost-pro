#!/bin/bash

# Build script for GMB Boost Pro Backend Docker container

echo "🚀 Building GMB Boost Pro Backend Docker container..."

# Build the Docker image
docker build -t gmb-boost-pro-backend:latest .

# Check if build was successful
if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully!"
    echo "📦 Image: gmb-boost-pro-backend:latest"
    
    # Show image details
    echo "📋 Image details:"
    docker images gmb-boost-pro-backend:latest
else
    echo "❌ Docker build failed!"
    exit 1
fi