# CoGallery: Sharded Storage Runbook

This guide covers how to deploy and scale CoGallery's backend using the new **Decentralized Load Balancing Architecture**. This architecture naturally load balances across thousands of free Oracle servers with ZERO single-points-of-failure and absolutely NO Cloudflare paid load balancers needed!

We have built a fully automated CLI tool (`npm run add-node`) that completely eliminates the need for manual SSH configuration.

---

## Part 1: Automated Node Setup

Whenever you spin up a brand new Oracle Cloud server (or need to forcefully re-sync an existing one), you use the automated CLI tool. It will automatically SSH into the machine, install Node.js 20, install PM2, clone the repository, inject your local Supabase `.env` secrets, and start the server.

### 1. Update your Configuration
Open the `bot/node-config.json` file on your local Windows PC. 
Add your new server's SSH connection string and the URL you assigned to it in Cloudflare:

```json
[
  {
    "SSH_COMMAND": "ssh -i E:\\project\\cogallery\\oracleinstance\\cogallerynode1\\ssh-key-2026-06-11.key ubuntu@68.233.107.22",
    "NODE_URL": "https://node1.25012004.xyz"
  }
]
```
*(You can place as many servers in this array as you want, and the tool will loop through all of them!)*

### 2. Run the Automation Tool
Open your terminal on your local PC and run:
```bash
cd bot
npm run add-node
```

**Done.** Your server is now fully configured. Within 60 seconds, it will send a heartbeat to Supabase and appear live on your Developer Dashboard.

---

## Part 2: Scaling to Multiple Servers (Adding Node 2)

When you hit your 90GB free storage limit and need to expand to a second free Oracle instance, here is exactly how you scale indefinitely without paying for Load Balancers.

### 1. DNS Setup in Cloudflare
Go to your Cloudflare Dashboard -> DNS Records and create simple **A Records** for your specific server nodes:
- **Type:** `A` | **Name:** `node1` | **Content:** `68.233.106.173` | **Proxy status:** Proxied (Orange Cloud)
- **Type:** `A` | **Name:** `node2` | **Content:** `68.233.107.22` | **Proxy status:** Proxied (Orange Cloud)

### 2. Auto-Provision the Nodes
Update your `bot/node-config.json` to include both servers in the JSON array.
Run `npm run add-node` on your local PC. It will automatically ssh into both servers and start them up!

### 3. There is no step 3. You are done!
Because CoGallery now uses **Decentralized Client-Side Load Balancing**, you DO NOT need to configure a Cloudflare Load Balancer.

### Summary of How the Scaled System Works
- A user goes to `25012004.xyz` to upload a video.
- Their browser asks your Supabase Database: "Give me a list of all live servers."
- The Database runs the `get_active_node` RPC and randomly returns `https://node2.25012004.xyz`.
- Their browser connects *directly* to **Node 2** and uploads the 5GB video.
- **Node 2** saves the 5GB video to its free Oracle hard drive.
- **Node 2** logs into Supabase and sets the video's URL to `https://node2.25012004.xyz/stream/photo123`.
- When a different user opens the gallery, their browser reads the database, sees the exact server that has the file, and requests `https://node2.25012004.xyz/stream/photo123` directly!

This architecture completely bypasses any centralized proxy bottlenecks, naturally providing Sticky Sessions and infinite horizontal scalability entirely for free!
