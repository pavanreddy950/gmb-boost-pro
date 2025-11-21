# Node.js backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy server source code
COPY . .

# Copy environment file for Azure
COPY .env.azure .env

# Expose port (Azure uses PORT env variable, default to 8080)
EXPOSE 8080

# Set environment to production
ENV NODE_ENV=production
ENV RUN_MODE=AZURE

# Start the server
CMD ["node", "server.js"]