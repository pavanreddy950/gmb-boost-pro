#!/bin/bash

# Local Development Server Startup Script
# This script sets the proper environment variables for local development

echo "🚀 Starting GMB Boost Pro Backend Server in LOCAL DEVELOPMENT mode..."
echo "📍 Backend will run on: http://localhost:5000"
echo "📍 Frontend should run on: http://localhost:3000"
echo "✅ CORS will be configured to allow localhost origins"
echo "✅ OAuth will redirect to localhost:3000"
echo ""

# Set environment variables for local development
export NODE_ENV=development
export RUN_MODE=LOCAL
export FRONTEND_URL=http://localhost:3000
export BACKEND_URL=http://localhost:5000
export GOOGLE_REDIRECT_URI=http://localhost:3000/auth/google/callback

echo "🔧 Local environment configured:"
echo "   Frontend: $FRONTEND_URL"  
echo "   Backend: $BACKEND_URL"
echo "   OAuth Redirect: $GOOGLE_REDIRECT_URI"
echo ""

# Start the server
node server.js
