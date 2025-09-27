# 🐳 Docker Setup for LOBAISEO Backend

This guide explains how to build, run, and manage the LOBAISEO Backend server using Docker.

## 📋 Prerequisites

- Docker installed on your system
- Docker Compose installed
- `.env` file configured (copy from `env.example` and fill in your values)

## 🚀 Quick Start

### 1. Build and Run (Development)
```bash
# Using npm scripts
npm run docker:build
npm run docker:run

# OR using shell scripts (Linux/Mac)
./docker-build.sh
./docker-run.sh

# OR using docker commands directly
docker build -t gmb-boost-pro-backend:latest .
docker-compose up -d
```

### 2. Production Deployment
```bash
# Using npm scripts
npm run docker:run:prod

# OR using shell script (Linux/Mac)
./docker-run-production.sh

# OR using docker commands directly
docker-compose -f docker-compose.production.yml up -d --build
```

### 3. Docker Hub Deployment 🌐

The image is available on Docker Hub: **`scale112/gmb-boost-pro-backend:latest`**

#### Pull and Run from Docker Hub
```bash
# Pull the latest image
npm run docker:pull
# OR
docker pull scale112/gmb-boost-pro-backend:latest

# Run the pulled image
docker run -d \
  --name gmb-boost-pro-backend \
  -p 5000:5000 \
  --env-file .env \
  scale112/gmb-boost-pro-backend:latest
```

#### Docker Hub Commands
```bash
# Tag and push to Docker Hub (for developers)
npm run docker:tag
npm run docker:push

# OR using shell script
./docker-push.sh scale112

# OR manually
docker tag gmb-boost-pro-backend:latest scale112/gmb-boost-pro-backend:latest
docker push scale112/gmb-boost-pro-backend:latest
```

## 📁 Docker Files Overview

- **`Dockerfile`** - Multi-stage build configuration for Node.js app
- **`.dockerignore`** - Excludes unnecessary files from build context
- **`docker-compose.yml`** - Development environment configuration
- **`docker-compose.production.yml`** - Production environment configuration
- **`docker-build.sh`** - Build script
- **`docker-run.sh`** - Development run script
- **`docker-run-production.sh`** - Production run script

## 🎯 Available Services

The container exposes the following endpoints:
- **Health Check**: `http://localhost:5000/health`
- **Google OAuth**: `http://localhost:5000/auth/google/url`
- **API Endpoints**: Various GMB API endpoints on port 5000

## 📊 Container Management

### View Logs
```bash
# Development
npm run docker:logs
# OR
docker-compose logs -f backend

# Production
npm run docker:logs:prod
# OR
docker-compose -f docker-compose.production.yml logs -f backend
```

### Stop Containers
```bash
# Development
npm run docker:stop
# OR
docker-compose down

# Production
npm run docker:stop:prod
# OR
docker-compose -f docker-compose.production.yml down
```

### Container Status
```bash
docker-compose ps
```

### Restart Container
```bash
# Development
docker-compose restart backend

# Production
docker-compose -f docker-compose.production.yml restart backend
```

## 🔧 Configuration

### Environment Variables

**Development** (`.env`):
- Uses development settings
- Mounts source code for live reloading
- Detailed logging

**Production** (`.env.production`):
- Optimized for production
- No source code mounting
- Limited logging with rotation

### Required Environment Variables:
```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
PORT=5000
NODE_ENV=production
FRONTEND_URL=http://localhost:3000
```

## 🏥 Health Checks

The container includes built-in health checks:
- **Endpoint**: `/health`
- **Interval**: Every 30 seconds
- **Timeout**: 3 seconds
- **Retries**: 3 attempts
- **Start Period**: 5 seconds

## 🔍 Troubleshooting

### Container Won't Start
1. Check if `.env` file exists and is properly configured
2. Verify Docker daemon is running
3. Check if port 5000 is available
4. Review container logs: `docker-compose logs backend`

### Build Failures
1. Ensure `package.json` and `package-lock.json` are present
2. Check Docker build context with `.dockerignore`
3. Verify Node.js dependencies are compatible

### Connection Issues
1. Verify container is running: `docker-compose ps`
2. Check health endpoint: `curl http://localhost:5000/health`
3. Ensure environment variables are set correctly
4. Check container logs for errors

## 🎨 Customization

### Port Configuration
To change the port, update:
1. `.env` file: `PORT=your_port`
2. `docker-compose.yml`: Update port mapping
3. `Dockerfile`: Update EXPOSE directive

### Adding Environment Variables
1. Add to `.env` or `.env.production`
2. Reference in `docker-compose.yml` under `environment` section

## 📈 Performance

The Docker image is optimized for:
- **Size**: Uses Alpine Linux base (~460MB total)
- **Security**: Runs as non-root user
- **Caching**: Multi-stage build with layer caching
- **Health**: Built-in health monitoring
- **Logging**: Configurable log rotation

## 🔐 Security Features

- Non-root user execution (nodejs:nodejs)
- Minimal attack surface with Alpine base
- No sensitive data in image layers
- Environment variable injection
- Health check monitoring

## 🚀 Production Deployment Tips

1. Use `.env.production` with production values
2. Set up reverse proxy (nginx/traefik) for SSL
3. Configure log aggregation
4. Monitor container health
5. Set up container restart policies
6. Use secrets management for sensitive data

---

**Image**: `gmb-boost-pro-backend:latest`
**Base**: `node:18-alpine`
**Port**: `5000`
**Health**: `/health`