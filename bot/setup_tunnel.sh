#!/bin/bash
echo "🌐 Setting up Cloudflare Quick Tunnel for CoGallery Backend..."

# Install cloudflared if not installed
if ! command -v cloudflared &> /dev/null
then
    echo "⬇️ Installing cloudflared..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
fi

echo "🚀 Starting Cloudflare Quick Tunnel on port 3000..."
echo "=========================================================="
echo "WAIT a few seconds, and look for the URL ending in '.trycloudflare.com'"
echo "Copy that URL and paste it into your local client/.env file as VITE_BACKEND_URL"
echo "=========================================================="

# Run cloudflared (this will stay open in the terminal so they can see the URL)
cloudflared tunnel --url http://localhost:3000
