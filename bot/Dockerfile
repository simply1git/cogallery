# Use a slim Node.js base image that supports ARM64 natively
FROM node:20-slim

# Install latest Chromium and dependencies required for Puppeteer on ARM64
RUN apt-get update \
    && apt-get install -y wget gnupg \
    && apt-get install -y chromium fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-kacst fonts-freefont-ttf libxss1 \
      --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Skip downloading Puppeteer's built-in Chromium (since we installed it via apt)
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm ci

# Copy the rest of the bot code
COPY . .

# Run the bot
CMD ["npm", "start"]
