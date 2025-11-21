# Lobaiseo Backend Docker Container Setup

## Overview
This document describes the setup and management of the **lobaiseo-backend** Docker container, a fresh container created to replace the previous backend container.

## Container Details
- **Container Name**: `lobaiseo-backend`
- **Image Name**: `lobaiseo-backend:latest`
- **Ports**: 
  - `5000:5000` (Primary backend API)
  - `8080:8080` (Alternative port)
- **Network**: `lobaiseo-network` (Bridge network)
- **Restart Policy**: `unless-stopped`

## Quick Start

### Option 1: Using Batch File (Easiest)
```bash
START_LOBAISEO_BACKEND.bat
```

### Option 2: Using PowerShell Script
```powershell
.\deploy-lobaiseo-backend.ps1
```

### Option 3: Using Docker Compose Directly
```bash
cd server
docker-compose -f docker-compose.lobaiseo-backend.yml up -d
```

## Files Created

1. **`server/docker-compose.lobaiseo-backend.yml`**
   - Docker Compose configuration for the lobaiseo-backend container
   - Defines container settings, environment variables, and networking

2. **`deploy-lobaiseo-backend.ps1`**
   - PowerShell deployment script
   - Handles cleanup, building, and starting the container
   - Provides status verification

3. **`START_LOBAISEO_BACKEND.bat`**
   - Simple batch file for one-click deployment
   - Executes the PowerShell script

## What the Deployment Script Does

1. **Cleanup**: Stops and removes any existing `lobaiseo-backend` container
2. **Image Cleanup**: Removes old Docker images for a fresh build
3. **Build**: Creates a new Docker image from the Dockerfile
4. **Deploy**: Starts the container using docker-compose
5. **Verify**: Checks that the container is running properly

## Environment Variables

The container is configured with the following environment variables:

```env
NODE_ENV=production
PORT=5000
RUN_MODE=AZURE
GOOGLE_CLIENT_ID=52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
FRONTEND_URL=http://localhost:3000
```

## Container Management Commands

### View Container Logs
```bash
docker logs lobaiseo-backend -f
```

### Check Container Status
```bash
docker ps --filter "name=lobaiseo-backend"
```

### Stop Container
```bash
docker stop lobaiseo-backend
```

### Start Container
```bash
docker start lobaiseo-backend
```

### Restart Container
```bash
docker restart lobaiseo-backend
```

### Remove Container
```bash
docker stop lobaiseo-backend
docker rm lobaiseo-backend
```

### Access Container Shell
```bash
docker exec -it lobaiseo-backend sh
```

### View Container Resource Usage
```bash
docker stats lobaiseo-backend
```

## Health Check

The container includes an automatic health check that:
- Runs every 30 seconds
- Checks the `/health` endpoint
- Has a 10-second timeout
- Allows 5 retries before marking as unhealthy
- Starts checking after 30 seconds

## Network

The container runs on a dedicated bridge network called `lobaiseo-network`. This allows:
- Isolation from other containers
- Easy service discovery
- Controlled communication between services

## Logging

Logs are configured with:
- **Driver**: JSON file
- **Max Size**: 10MB per log file
- **Max Files**: 3 rotating log files

## Troubleshooting

### Container Won't Start
1. Check if port 5000 or 8080 is already in use:
   ```bash
   netstat -ano | findstr :5000
   netstat -ano | findstr :8080
   ```
2. View logs for error messages:
   ```bash
   docker logs lobaiseo-backend
   ```

### Build Fails
1. Ensure Docker is running
2. Check if you have sufficient disk space
3. Verify the Dockerfile syntax in `server/Dockerfile`

### Container Exits Immediately
1. Check logs: `docker logs lobaiseo-backend`
2. Verify environment variables are correct
3. Ensure the Node.js application starts properly

### Can't Access Backend API
1. Verify container is running: `docker ps`
2. Check health status: `docker inspect lobaiseo-backend | findstr Health`
3. Test endpoint: `curl http://localhost:5000/health`

## Docker Hub Deployment (Optional)

To push this container to Docker Hub:

```bash
# Tag the image
docker tag lobaiseo-backend:latest scale112/lobaiseo-backend:latest

# Login to Docker Hub
docker login

# Push to Docker Hub
docker push scale112/lobaiseo-backend:latest
```

## Differences from Previous Container

This is a **completely fresh container** with:
- Updated container name: `lobaiseo-backend`
- Clean slate build (no cached layers from previous container)
- Updated docker-compose configuration
- Dedicated deployment scripts
- Proper health checks and logging

## Support

For issues or questions:
1. Check the container logs first
2. Verify environment variables are correct
3. Ensure ports are not conflicting
4. Review Docker and Node.js documentation

---

**Created**: November 2025  
**Container Name**: lobaiseo-backend  
**Status**: Active
