#!/bin/bash

# Deploy and Test Script for 5etools Character Sync WebSocket
# This script deploys the worker and runs both API and WebSocket tests

set -e  # Exit on any error

echo "🚀 5etools Character Sync WebSocket - Deploy & Test"
echo "=================================================="

# Check if we're in the correct directory
if [ ! -f "wrangler.toml" ]; then
    echo "❌ Error: wrangler.toml not found. Please run this script from the cloudflare-worker directory."
    exit 1
fi

# Check if wrangler is installed
if ! command -v wrangler &> /dev/null; then
    echo "❌ Error: Wrangler CLI not found. Please install it:"
    echo "   npm install -g wrangler"
    exit 1
fi

# Deploy to development environment
echo ""
echo "📦 Deploying to development environment..."
wrangler deploy --env development

# Get the deployment URL
WORKER_URL=$(wrangler subdomain get --env development 2>/dev/null || echo "https://5etools-character-sync-dev.your-subdomain.workers.dev")

echo "✅ Deployment complete!"
echo "🌐 Worker URL: $WORKER_URL"
echo ""

# Check if Node.js dependencies are installed
echo "📋 Checking test dependencies..."
if [ ! -d "node_modules" ]; then
    echo "📦 Installing Node.js dependencies..."
    npm init -y 2>/dev/null || true
    npm install ws node-fetch 2>/dev/null || true
fi

# Set worker URL for tests
export WORKER_URL=$WORKER_URL

# Wait a moment for deployment to be ready
echo "⏳ Waiting for worker to be ready..."
sleep 5

# Run basic API tests
echo ""
echo "🧪 Running API tests..."
if node test-api.js; then
    echo "✅ API tests passed!"
else
    echo "❌ API tests failed!"
    exit 1
fi

# Run WebSocket tests
echo ""
echo "🧪 Running WebSocket broadcast tests..."
if node test-websocket.js; then
    echo "✅ WebSocket tests passed!"
else
    echo "❌ WebSocket tests failed!"
    exit 1
fi

echo ""
echo "🎉 All tests passed! WebSocket broadcasting is working correctly."
echo ""
echo "📋 Next steps:"
echo "   1. Update your frontend to connect to: $WORKER_URL"
echo "   2. Use WebSocket URL: ${WORKER_URL/https/wss}/?room=character-sync&userId=YOUR_USER_ID"
echo "   3. Listen for CHARACTER_CREATED, CHARACTER_UPDATED, CHARACTER_DELETED events"
echo ""
echo "🔧 To deploy to production:"
echo "   wrangler deploy --env production"