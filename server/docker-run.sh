#!/bin/bash

# Run script for GMB Boost Pro Backend Docker container

echo "🚀 Starting GMB Boost Pro Backend Docker container..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "⚠️  Warning: .env file not found. Please create one based on env.example"
    echo "Using development configuration..."
fi

# Stop and remove existing container if it exists
echo "🛑 Stopping existing container (if any)..."
docker-compose down

# Start the container using docker-compose
echo "🏗️  Starting container with docker-compose..."
docker-compose up -d

# Check if container started successfully
if [ $? -eq 0 ]; then
    echo "✅ Container started successfully!"
    echo "🌐 Backend server should be running at: http://localhost:5000"
    echo ""
    echo "📊 Container status:"
    docker-compose ps
    echo ""
    echo "📋 Useful commands:"
    echo "  docker-compose logs -f backend    # View logs"
    echo "  docker-compose down               # Stop container"
    echo "  docker-compose restart backend   # Restart container"
else
    echo "❌ Failed to start container!"
    exit 1
fi