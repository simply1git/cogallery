import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, '../node-config.json');
const envPath = path.join(__dirname, '../.env');

// 1. Check if node-config.json exists
if (!fs.existsSync(configPath)) {
  const template = {
    "SSH_COMMAND": "ssh -i C:\\Users\\Hp\\Downloads\\mykey.key ubuntu@123.45.67.89",
    "NODE_URL": "https://node2.25012004.xyz"
  };
  fs.writeFileSync(configPath, JSON.stringify(template, null, 2));
  console.log('✅ Created node-config.json template in the bot/ folder.');
  console.log('👉 Please edit node-config.json with your new SSH command and NODE_URL, then run this script again!');
  process.exit(0);
}

// 2. Read configuration
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
if (config.SSH_COMMAND.includes('123.45.67.89')) {
  console.log('❌ You need to update node-config.json with your actual SSH command and NODE_URL.');
  process.exit(1);
}

// 3. Read local .env file
let localEnv = '';
if (fs.existsSync(envPath)) {
  localEnv = fs.readFileSync(envPath, 'utf-8');
} else {
  console.log('❌ Could not find bot/.env file. Ensure it exists so we can copy secrets to the new server.');
  process.exit(1);
}

// 4. Inject the new NODE_URL
localEnv = localEnv.split('\n').filter(line => !line.startsWith('NODE_URL=')).join('\n');
localEnv += `\nNODE_URL=${config.NODE_URL}\n`;

// 5. Construct the bash script to execute on the remote server
const setupScript = `
#!/bin/bash
set -e

echo "🚀 Starting automated node setup for ${config.NODE_URL}..."

# Wait for apt lock to clear
while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
  echo "Waiting for dpkg lock..."
  sleep 2
done

# Install Node.js if missing
if ! command -v node &> /dev/null
then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

# Install PM2 if missing
if ! command -v pm2 &> /dev/null
then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi

# Clone or Update CoGallery
if [ -d "cogallery" ]; then
  echo "🔄 Updating existing CoGallery repo..."
  cd cogallery/bot
  git reset --hard
  git pull origin main
else
  echo "📥 Cloning CoGallery repo..."
  git clone https://github.com/simply1git/cogallery.git
  cd cogallery/bot
fi

# Write .env file
echo "🔑 Writing environment variables..."
cat << 'EOF' > .env
${localEnv}
EOF

# Install & Start
echo "⚙️ Installing dependencies..."
npm install --production

echo "🚀 Starting PM2..."
pm2 start ecosystem.config.cjs || pm2 restart cogallery-seedbox
pm2 save

echo "✅ Node Setup Complete! It will appear in your Developer Dashboard within 60 seconds."
`;

// 6. Execute over SSH
console.log(`🔌 Connecting to server via SSH...`);
try {
  execSync(`${config.SSH_COMMAND} "bash -s"`, { 
    input: setupScript,
    stdio: ['pipe', 'inherit', 'inherit'] 
  });
  console.log('🎉 Setup successfully finished!');
} catch (error) {
  console.error('❌ SSH Command failed. Please check your connection string and key path.');
}
