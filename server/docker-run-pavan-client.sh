#!/bin/bash

# Pavan Client Backend Container Management Script
# This script manages the pavan-client Docker container

set -e  # Exit on any error

echo "🚀 Pavan Client Backend Container Management"
echo "============================================"

# Function to check if container is running
check_container_status() {
    if docker ps | grep -q "pavan-client"; then
        echo "✅ Container 'pavan-client' is running"
        return 0
    else
        echo "❌ Container 'pavan-client' is not running"
        return 1
    fi
}

# Function to show container logs
show_logs() {
    echo "📋 Showing logs for pavan-client container..."
    docker-compose -f docker-compose.pavan-client.yml logs -f --tail=50 backend
}

# Function to build and start container
start_container() {
    echo "🏗️ Building and starting pavan-client container..."
    
    # Stop existing container if running
    echo "🛑 Stopping existing container (if any)..."
    docker-compose -f docker-compose.pavan-client.yml down 2>/dev/null || true
    
    # Remove existing image to rebuild
    echo "🗑️ Removing existing image (if any)..."
    docker rmi pavan-client-backend:latest 2>/dev/null || true
    
    # Build and start new container
    echo "🔨 Building new container..."
    docker-compose -f docker-compose.pavan-client.yml build --no-cache
    
    echo "▶️ Starting container..."
    docker-compose -f docker-compose.pavan-client.yml up -d
    
    # Wait for health check
    echo "⏳ Waiting for container to be healthy..."
    sleep 10
    
    # Check status
    if check_container_status; then
        echo "🎉 Pavan-client container started successfully!"
        echo "🌐 Backend available at: http://localhost:5000"
        echo "❤️ Health check: http://localhost:5000/health"
        echo "⚙️ Config check: http://localhost:5000/config"
        
        # Show first few logs
        echo "📋 Initial logs:"
        docker-compose -f docker-compose.pavan-client.yml logs --tail=10 backend
    else
        echo "❌ Failed to start container"
        exit 1
    fi
}

# Function to stop container
stop_container() {
    echo "🛑 Stopping pavan-client container..."
    docker-compose -f docker-compose.pavan-client.yml down
    echo "✅ Container stopped"
}

# Function to restart container
restart_container() {
    echo "🔄 Restarting pavan-client container..."
    stop_container
    sleep 2
    start_container
}

# Function to show container stats
show_stats() {
    echo "📊 Container statistics:"
    if docker ps | grep -q "pavan-client"; then
        docker stats pavan-client --no-stream
    else
        echo "❌ Container is not running"
    fi
}

# Main script logic
case "${1:-}" in
    "start")
        start_container
        ;;
    "stop")
        stop_container
        ;;
    "restart")
        restart_container
        ;;
    "logs")
        show_logs
        ;;
    "status")
        check_container_status
        if docker ps | grep -q "pavan-client"; then
            echo "🌐 Backend URL: http://localhost:5000"
            echo "❤️ Health check: http://localhost:5000/health"
        fi
        ;;
    "stats")
        show_stats
        ;;
    "health")
        echo "🏥 Checking health endpoint..."
        curl -f http://localhost:5000/health || echo "❌ Health check failed"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|status|stats|health}"
        echo ""
        echo "Commands:"
        echo "  start   - Build and start the pavan-client container"
        echo "  stop    - Stop the container"
        echo "  restart - Restart the container"
        echo "  logs    - Show container logs"
        echo "  status  - Check if container is running"
        echo "  stats   - Show container resource usage"
        echo "  health  - Test the health endpoint"
        echo ""
        echo "Examples:"
        echo "  $0 start    # Start the container"
        echo "  $0 logs     # View logs"
        echo "  $0 status   # Check status"
        exit 1
        ;;
esac