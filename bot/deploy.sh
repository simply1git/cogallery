#!/bin/bash
echo "🚀 Deploying CoGallery Native Seedbox Bot..."

# Pull latest code
git pull origin main

# Install dependencies (no more Docker!)
npm install --production

# Restart PM2 process
pm2 restart ecosystem.config.cjs

echo "✅ Deployment complete. Check logs with: pm2 logs cogallery-seedbox"
