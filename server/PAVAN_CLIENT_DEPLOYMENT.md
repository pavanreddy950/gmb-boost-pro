# Pavan Client Backend Deployment Guide

## 🚀 Quick Start - Deploy from Docker Hub

The **pavan-client** backend container has been successfully pushed to Docker Hub and is ready for deployment.

### **Docker Hub Repository**
- **Repository**: `scale112/pavan-client-backend`
- **Docker Hub URL**: https://hub.docker.com/r/scale112/pavan-client-backend
- **Available Tags**: `latest`, `v1.0.0`

---

## 🐳 Deployment Options

### **Option 1: Docker Compose (Recommended)**

1. **Download the deployment file:**
   ```bash
   # If you have the repo
   cd server
   docker-compose -f docker-compose.pavan-client-hub.yml up -d
   ```

2. **Or create your own docker-compose.yml:**
   ```yaml
   version: '3.8'
   services:
     backend:
       image: scale112/pavan-client-backend:latest
       container_name: pavan-client
       ports:
         - "5000:5000"
       environment:
         - NODE_ENV=production
         - PORT=5000
         - GOOGLE_CLIENT_ID=1027867101-nngjahkgsj6ogifi45uuebbrgafmkooi.apps.googleusercontent.com
         - GOOGLE_CLIENT_SECRET=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
         - FRONTEND_URL=https://delightful-sea-062191a0f.2.azurestaticapps.net
         - BACKEND_URL=http://localhost:5000
       restart: unless-stopped
   ```

3. **Run the container:**
   ```bash
   docker-compose up -d
   ```

### **Option 2: Direct Docker Run**

```bash
# Pull the image
docker pull scale112/pavan-client-backend:latest

# Run the container
docker run -d \
  --name pavan-client \
  -p 5000:5000 \
  -e NODE_ENV=production \
  -e PORT=5000 \
  -e GOOGLE_CLIENT_ID=1027867101-nngjahkgsj6ogifi45uuebbrgafmkooi.apps.googleusercontent.com \
  -e GOOGLE_CLIENT_SECRET=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 \
  -e FRONTEND_URL=https://delightful-sea-062191a0f.2.azurestaticapps.net \
  -e BACKEND_URL=http://localhost:5000 \
  -e GOOGLE_REDIRECT_URI=https://delightful-sea-062191a0f.2.azurestaticapps.net/auth/google/callback \
  --restart unless-stopped \
  scale112/pavan-client-backend:latest
```

### **Option 3: Specific Version**

```bash
# Use specific version
docker pull scale112/pavan-client-backend:v1.0.0
docker run -d --name pavan-client -p 5000:5000 scale112/pavan-client-backend:v1.0.0
```

---

## ⚙️ Configuration

### **Required Environment Variables**
| Variable | Value | Description |
|----------|-------|-------------|
| `GOOGLE_CLIENT_ID` | `1027867101-nngjahkgsj6ogifi45uuebbrgafmkooi.apps.googleusercontent.com` | Google OAuth Client ID |
| `GOOGLE_CLIENT_SECRET` | `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` | Google OAuth Client Secret |
| `FRONTEND_URL` | `https://delightful-sea-062191a0f.2.azurestaticapps.net` | Frontend application URL |
| `BACKEND_URL` | `http://localhost:5000` | Backend server URL |

### **Optional Environment Variables**
| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Server port |
| `NODE_ENV` | `production` | Environment mode |
| `RAZORPAY_KEY_ID` | `rzp_live_RFSzT9EvJ2cwJI` | Payment gateway key |

---

## 🔧 Container Management

### **Start Container**
```bash
docker start pavan-client
```

### **Stop Container**
```bash
docker stop pavan-client
```

### **View Logs**
```bash
docker logs -f pavan-client
```

### **Container Status**
```bash
docker ps | grep pavan-client
```

### **Health Check**
```bash
curl http://localhost:5000/health
curl http://localhost:5000/config
```

---

## 🌐 Endpoints

Once deployed, the following endpoints will be available:

### **Core Endpoints**
- **Health Check**: `http://localhost:5000/health`
- **Configuration**: `http://localhost:5000/config`
- **OAuth URL**: `http://localhost:5000/auth/google/url`
- **OAuth Callback**: `http://localhost:5000/auth/google/callback`

### **Google Business Profile API**
- **Accounts**: `http://localhost:5000/api/accounts`
- **Locations**: `http://localhost:5000/api/accounts/:accountName/locations`
- **Reviews**: `http://localhost:5000/api/locations/:locationId/reviews`
- **Posts**: `http://localhost:5000/api/locations/:locationId/posts`
- **Insights**: `http://localhost:5000/api/locations/:locationId/insights`

### **Automation**
- **Test Post**: `http://localhost:5000/api/automation/test-post-now/:locationId`
- **Test Reviews**: `http://localhost:5000/api/automation/test-review-check/:locationId`

---

## 🔍 Troubleshooting

### **Container Won't Start**
```bash
# Check container status
docker ps -a | grep pavan-client

# Check logs for errors
docker logs pavan-client

# Restart container
docker restart pavan-client
```

### **Port Already in Use**
```bash
# Check what's using port 5000
netstat -tulpn | grep :5000  # Linux
netstat -an | findstr :5000  # Windows

# Use different port
docker run -p 5001:5000 scale112/pavan-client-backend:latest
```

### **Health Check Failed**
```bash
# Test health endpoint
curl http://localhost:5000/health

# Check container logs
docker logs pavan-client

# Verify environment variables
docker exec pavan-client env | grep GOOGLE
```

---

## 🚀 Production Deployment

### **Azure Container Instances**
```bash
az container create \
  --resource-group myResourceGroup \
  --name pavan-client \
  --image scale112/pavan-client-backend:latest \
  --dns-name-label pavan-client \
  --ports 5000 \
  --environment-variables \
    NODE_ENV=production \
    GOOGLE_CLIENT_ID=1027867101-nngjahkgsj6ogifi45uuebbrgafmkooi.apps.googleusercontent.com \
    GOOGLE_CLIENT_SECRET=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
```

### **AWS ECS/Fargate**
Create a task definition using the image `scale112/pavan-client-backend:latest` with the required environment variables.

### **Google Cloud Run**
```bash
gcloud run deploy pavan-client \
  --image scale112/pavan-client-backend:latest \
  --platform managed \
  --port 5000 \
  --set-env-vars NODE_ENV=production,GOOGLE_CLIENT_ID=1027867101-nngjahkgsj6ogifi45uuebbrgafmkooi.apps.googleusercontent.com
```

---

## 📊 Container Specifications

| Specification | Value |
|---------------|-------|
| **Base Image** | `node:18-alpine` |
| **Size** | `~615MB` |
| **Port** | `5000` |
| **Memory Limit** | `1GB` |
| **CPU Limit** | `1.0` |
| **Health Check** | `30s interval` |
| **Restart Policy** | `unless-stopped` |

---

## 🔐 Security Notes

- Google OAuth credentials are configured for production use
- Razorpay keys are set for live payments
- Container runs with non-root user for security
- All secrets should be managed via environment variables
- Enable HTTPS in production deployments

---

## 📞 Support

For issues or questions:
1. Check container logs: `docker logs pavan-client`
2. Verify health endpoint: `curl http://localhost:5000/health`
3. Review environment variables
4. Check Google Cloud Console OAuth configuration

---

**Container Repository**: https://hub.docker.com/r/scale112/pavan-client-backend

**Tags Available**: `latest`, `v1.0.0`

**Built**: $(date)
**Architecture**: Multi-platform (AMD64/ARM64)