# Use Node.js 18 Alpine for smaller image size
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Copy package files first for better Docker layer caching
COPY package*.json ./

# Install dependencies (production only for smaller image)
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Change ownership to nodejs user
RUN chown -R nodejs:nodejs /app

# Verify .env.azure is present (it should be included via .dockerignore negation)
RUN ls -la .env.azure || echo "Warning: .env.azure not found, will use production defaults"

# Switch to non-root user for security
USER nodejs

# Expose the port that server will run on
# Note: Azure Web Apps will override this with dynamic port via PORT env variable
EXPOSE 5000
EXPOSE 8080

# Add health check to monitor container health
# Use PORT environment variable for health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
  CMD node -e "const port = process.env.PORT || 5000; require('http').get('http://localhost:' + port + '/health', (res) => { if (res.statusCode === 200) { process.exit(0) } else { process.exit(1) } })" || exit 1

# Set environment variables for production
ENV NODE_ENV=production
ENV RUN_MODE=AZURE
# Don't hardcode PORT - let Azure set it dynamically
# Azure Web Apps will provide PORT environment variable

# Start the application
CMD ["npm", "start"]