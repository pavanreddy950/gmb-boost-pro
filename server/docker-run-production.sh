#!/bin/bash

# Production run script for GMB Boost Pro Backend Docker container

echo "🚀 Starting GMB Boost Pro Backend Docker container (PRODUCTION MODE)..."

# Check if .env.production file exists
if [ ! -f .env.production ]; then
    echo "❌ Error: .env.production file not found!"
    echo "Please create a .env.production file with production environment variables."
    exit 1
fi

# Stop and remove existing container if it exists
echo "🛑 Stopping existing containers..."
docker-compose -f docker-compose.production.yml down

# Build and start the container using production docker-compose
echo "🏗️  Building and starting production container..."
docker-compose -f docker-compose.production.yml up -d --build

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "✅ Production container started successfully!"
    echo "🌐 Backend server is running at: http://localhost:5000"
    echo ""
    echo "📊 Container status:"
    docker-compose -f docker-compose.production.yml ps
    echo ""
    echo "📋 Useful production commands:"
    echo "  docker-compose -f docker-compose.production.yml logs -f backend    # View logs"
    echo "  docker-compose -f docker-compose.production.yml down               # Stop container"
    echo "  docker-compose -f docker-compose.production.yml restart backend   # Restart container"
else
    echo "❌ Failed to start production container!"
    exit 1
fi