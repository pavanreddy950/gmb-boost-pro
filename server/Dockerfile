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

# Switch to non-root user for security
USER nodejs

# Expose the port that server will run on
EXPOSE 5000

# Add health check to monitor container health
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=5 \
  CMD node -e "require('http').get('http://localhost:5000/health', (res) => { if (res.statusCode === 200) { process.exit(0) } else { process.exit(1) } })" || exit 1

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=5000

# Start the application
CMD ["npm", "start"]