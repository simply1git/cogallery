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
    "NODE_URL": "https://node2.25012004.xyz",
    "CLOUDFLARE_TUNNEL_TOKEN": ""
  };
  fs.writeFileSync(configPath, JSON.stringify(template, null, 2));
  console.log('✅ Created node-config.json template in the bot/ folder.');
  console.log('👉 Please edit node-config.json with your new SSH command and NODE_URL, then run this script again!');
  process.exit(0);
}

let configs = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
if (!Array.isArray(configs)) {
  // Backwards compatibility if it's a single object
  configs = [configs];
}

let localEnv = '';
if (fs.existsSync(envPath)) {
  localEnv = fs.readFileSync(envPath, 'utf-8');
} else {
  console.log('❌ Could not find bot/.env file. Ensure it exists so we can copy secrets to the new server.');
  process.exit(1);
}

for (let i = 0; i < configs.length; i++) {
  const config = configs[i];
  
  // Skip instructions or comments
  if (!config.SSH_COMMAND || !config.NODE_URL) continue;
  
  if (config.SSH_COMMAND.includes('123.45.67.89') || config.SSH_COMMAND.includes('YOUR_NEW_IP_HERE')) {
    console.log(`⚠️ Skipping node ${config.NODE_URL} because it still has placeholder IP addresses.`);
    continue;
  }

  // Inject the new NODE_URL
  let nodeEnv = localEnv.split('\n').filter(line => !line.startsWith('NODE_URL=')).join('\n');
  nodeEnv += `\nNODE_URL=${config.NODE_URL}\n`;

  const setupScript = `
#!/bin/bash
set -e

echo "🚀 Starting automated node setup for ${config.NODE_URL}..."

while sudo fuser /var/lib/dpkg/lock-frontend >/dev/null 2>&1; do
  echo "Waiting for dpkg lock..."
  sleep 2
done

if ! command -v node &> /dev/null
then
  echo "📦 Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

if ! command -v pm2 &> /dev/null
then
  echo "📦 Installing PM2..."
  sudo npm install -g pm2
fi

if [ -n "${config.CLOUDFLARE_TUNNEL_TOKEN || ''}" ]; then
  if ! command -v cloudflared &> /dev/null
  then
    echo "🛡️ Installing Cloudflare Tunnel..."
    curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64.deb
    sudo dpkg -i cloudflared.deb
    rm cloudflared.deb
  fi
  echo "🛡️ Securing node with Cloudflare Tunnel..."
  sudo cloudflared service install ${config.CLOUDFLARE_TUNNEL_TOKEN} || true
  sudo systemctl start cloudflared || true
fi

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

echo "🔑 Writing environment variables..."
cat << 'EOF' > .env
${nodeEnv}
EOF

echo "⚙️ Installing dependencies..."
npm install --production

echo "🚀 Starting PM2..."
pm2 start ecosystem.config.cjs || pm2 restart cogallery-seedbox
pm2 save

echo "✅ Node Setup Complete for ${config.NODE_URL}!"
`;

  console.log(`\n======================================================`);
  console.log(`🔌 [${i+1}/${configs.length}] Deploying to ${config.NODE_URL}...`);
  console.log(`======================================================`);
  
  try {
    execSync(`${config.SSH_COMMAND} "bash -s"`, { 
      input: setupScript,
      stdio: ['pipe', 'inherit', 'inherit'] 
    });
    console.log(`🎉 Successfully finished ${config.NODE_URL}!\n`);
  } catch (error) {
    console.error(`❌ SSH Command failed for ${config.NODE_URL}. Moving to next...`);
  }
}

