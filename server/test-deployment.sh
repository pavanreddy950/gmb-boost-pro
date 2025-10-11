#!/bin/bash

# Test Azure Deployment Script
# Verifies that the backend is properly deployed and responding

set -e

echo "🧪 Testing Azure Deployment"
echo "==========================="
echo ""

BACKEND_URL="https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net"
FRONTEND_URL="https://www.app.lobaiseo.com"

echo "📋 Testing endpoints:"
echo "   Backend: $BACKEND_URL"
echo "   Frontend: $FRONTEND_URL"
echo ""

# Test 1: Health Check
echo "🔍 Test 1: Health Check"
echo "   GET $BACKEND_URL/health"
HEALTH_RESPONSE=$(curl -s "$BACKEND_URL/health" || echo '{"error":"failed"}')
echo "   Response: $HEALTH_RESPONSE"

if echo "$HEALTH_RESPONSE" | grep -q "ok"; then
    echo "   ✅ Health check passed"
else
    echo "   ❌ Health check failed - Backend may not be running"
    echo ""
    echo "⚠️ Backend is not responding. Common issues:"
    echo "   1. Container hasn't started yet (wait 2-5 minutes after deployment)"
    echo "   2. Application error due to missing environment variables"
    echo "   3. Docker image not pulled correctly"
    echo ""
    echo "📋 Check Azure logs:"
    echo "   https://portal.azure.com → pavan-client-backend-bxgdaqhvarfdeuhe → Log stream"
    exit 1
fi

echo ""

# Test 2: CORS Preflight
echo "🔍 Test 2: CORS Preflight (OPTIONS request)"
echo "   OPTIONS $BACKEND_URL/api/payment/subscription/status"

CORS_RESPONSE=$(curl -s -X OPTIONS "$BACKEND_URL/api/payment/subscription/status" \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: GET" \
    -I || echo "FAILED")

echo "   Response headers:"
echo "$CORS_RESPONSE" | grep -i "access-control" || echo "   ❌ No CORS headers found"

if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then
    echo "   ✅ CORS headers present"
else
    echo "   ⚠️ CORS headers missing - Frontend requests may fail"
fi

echo ""

# Test 3: Token Status Endpoint
echo "🔍 Test 3: Token Status Endpoint"
TEST_USER_ID="test-user-123"
echo "   GET $BACKEND_URL/auth/google/token-status/$TEST_USER_ID"

TOKEN_RESPONSE=$(curl -s "$BACKEND_URL/auth/google/token-status/$TEST_USER_ID" || echo '{"error":"failed"}')
echo "   Response: $(echo $TOKEN_RESPONSE | cut -c1-100)..."

if echo "$TOKEN_RESPONSE" | grep -qE "(hasToken|error|false)"; then
    echo "   ✅ Endpoint responding correctly"
else
    echo "   ⚠️ Unexpected response format"
fi

echo ""

# Test 4: Environment Configuration
echo "🔍 Test 4: Environment Configuration Check"
echo "   This test verifies CORS configuration is correct"

# Test from frontend origin
CORS_TEST=$(curl -s -X OPTIONS "$BACKEND_URL/auth/google/url" \
    -H "Origin: $FRONTEND_URL" \
    -H "Access-Control-Request-Method: GET" \
    -I | grep -i "access-control-allow-origin" || echo "FAILED")

if echo "$CORS_TEST" | grep -q "$FRONTEND_URL"; then
    echo "   ✅ Frontend URL ($FRONTEND_URL) is allowed"
else
    echo "   ❌ Frontend URL not in allowed origins"
    echo "   This will cause connection issues!"
fi

echo ""
echo "================================"
echo "📊 Test Summary"
echo "================================"

# Count passed tests
PASSED=0
if echo "$HEALTH_RESPONSE" | grep -q "ok"; then ((PASSED++)); fi
if echo "$CORS_RESPONSE" | grep -qi "access-control-allow-origin"; then ((PASSED++)); fi
if echo "$TOKEN_RESPONSE" | grep -qE "(hasToken|error|false)"; then ((PASSED++)); fi
if echo "$CORS_TEST" | grep -q "$FRONTEND_URL"; then ((PASSED++)); fi

echo "Tests passed: $PASSED/4"
echo ""

if [ $PASSED -eq 4 ]; then
    echo "🎉 All tests passed! Backend is properly deployed."
    echo ""
    echo "✅ You can now:"
    echo "   1. Visit $FRONTEND_URL"
    echo "   2. Login to your account"
    echo "   3. Connect your Google Business Profile"
    exit 0
elif [ $PASSED -ge 2 ]; then
    echo "⚠️ Some tests failed but backend is responding."
    echo "Check the failed tests above and review Azure logs."
    exit 1
else
    echo "❌ Most tests failed. Backend may not be deployed correctly."
    echo ""
    echo "📋 Troubleshooting steps:"
    echo "   1. Check Azure Portal logs"
    echo "   2. Verify Docker image is correct: scale112/pavan-client-backend:latest"
    echo "   3. Ensure environment variables are set in Azure"
    echo "   4. Try restarting the App Service"
    exit 1
fi
