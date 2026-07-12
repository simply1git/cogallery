#!/bin/bash
# Oracle P2P Node Update Script
# Usage: ./update-oracle-node.sh [node-name] [environment]

set -e

NODE_NAME=${1:-"oracle-node-01"}
ENVIRONMENT=${2:-"production"}

echo "🔄 Updating Oracle P2P Node: $NODE_NAME (Environment: $ENVIRONMENT)"

# 1. Pull latest code
echo "📥 Pulling latest code from repository..."
git pull origin main

# 2. Install production dependencies
echo "📦 Installing dependencies..."
npm ci --production

# 3. Skip build (using raw js files)
echo "🏗️ Skipping build step..."

# 4. Update configuration if needed
echo "⚙️ Updating configuration..."
if [ -f "node-config.$ENVIRONMENT.json" ]; then
  cp "node-config.$ENVIRONMENT.json" "node-config.json"
  echo "   Loaded environment-specific config: node-config.$ENVIRONMENT.json"
elif [ -f "node-config.json" ]; then
  echo "   Using existing node-config.json"
else
  echo "   Creating default node-config.json"
  cat > node-config.json << EOF
{
  "nodeId": "$NODE_NAME-$ENVIRONMENT",
  "listenPort": 3000,
  "maxConnections": 100,
  "storagePaths": ["/var/lib/cogallery/storage"],
  "healthCheckInterval": 30000,
  "gossipInterval": 5000,
  "maxChunkSize": 5242880,
  "replicationFactor": 3,
  "logLevel": "info"
}
EOF
fi

# 5. Restart the service using PM2
echo "🔄 Restarting service with PM2..."
pm2 stop "cogallery-oracle-$NODE_NAME" || true
pm2 delete "cogallery-oracle-$NODE_NAME" || true

# Start with appropriate environment file
if [ -f ".env.$ENVIRONMENT" ]; then
  echo "   Using environment file: .env.$ENVIRONMENT"
  pm2 start bot_server_oracle.js \
    --name "cogallery-oracle-$NODE_NAME" \
    --env "$ENVIRONMENT"
else
  echo "   Using default environment"
  pm2 start bot_server_oracle.js \
    --name "cogallery-oracle-$NODE_NAME" \
    --env "$ENVIRONMENT"
fi

# 6. Save PM2 process list
pm2 save

# 7. Verify the node is healthy
echo "🩺 Performing health check..."
sleep 10

HEALTH_CHECK_URL="http://localhost:3000/health"
if curl -s "$HEALTH_CHECK_URL" | grep -q '"status":"OK"'; then
  echo "✅ Node $NODE_NAME is healthy and ready!"
else
  echo "⚠️  Health check failed for $NODE_NAME"
  echo "   Check logs with: pm2 logs cogallery-oracle-$NODE_NAME"
fi

echo "📋 Update complete for $NODE_NAME"
echo "   To view logs: pm2 logs cogallery-oracle-$NODE_NAME"
echo "   To monitor: pm2 show cogallery-oracle-$NODE_NAME"