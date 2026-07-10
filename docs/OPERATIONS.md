# CoGallery Operational Runbook

This document provides operational procedures for running and maintaining CoGallery in production.

## Table of Contents
1. [System Overview](#system-overview)
2. [Health Checks](#health-checks)
3. [Monitoring](#monitoring)
4. [Backup and Recovery](#backup-and-recovery)
5. [Scaling Procedures](#scaling-procedures)
6. [Troubleshooting](#troubleshooting)
7. [Maintenance Procedures](#maintenance-procedures)
8. [Security Procedures](#security-procedures)

## System Overview

CoGallery consists of three main components:
1. **Frontend**: React/Vite application (deployed to Vercel or similar)
2. **Backend API**: Supabase (PostgreSQL, Auth, Storage)
3. **Storage Nodes**: Oracle Backend servers (Node.js) for media processing and distribution

### Configuration and Feature Flags
- Frontend configuration via environment variables and runtime feature flags
- Feature flags enable gradual rollout of new capabilities
- Configuration centralized in client/src/lib/config.ts and client/src/lib/featureFlags.ts
- Storage nodes configured via environment variables

## Health Checks

### Frontend Health
- Check if the application loads correctly in browser
- Verify console shows no errors
- Test basic functionality (login, upload, view)

### Backend Health (Supabase)
- Supabase Dashboard shows healthy status
- API endpoints respond correctly
- Authentication service operational

### Storage Node Health
Each storage node exposes two health endpoints:

1. **Basic Health Check**:
   ```
   GET http://STORAGE_NODE_URL/status
   ```
   Expected response: `{"status":"online","service":"CoGallery Oracle Backend"}`

2. **Detailed Telemetry** (requires admin auth):
   ```
   GET http://STORAGE_NODE_URL/developer/telemetry
   ```
   Returns detailed system metrics including CPU, memory, disk usage, and storage stats.

## Monitoring

### Prometheus Metrics
Storage nodes expose Prometheus-compatible metrics at:
```
GET http://STORAGE_NODE_URL/metrics
```

Key metrics include:
- Memory usage (cogallery_memory_bytes)
- Disk usage (cogallery_disk_bytes)
- System uptime (cogallery_uptime_seconds)

### Additional Monitoring Features
- **Background Sync Status**: Storage nodes now support Background Sync API for reliable upload queuing
- **Worker Metrics**: Hash computation and image processing are offloaded to Web Workers with monitoring capabilities
- **Upload Queue Monitoring**: Enhanced visibility into upload queue status and processing
- **Feature Flags**: System status and feature rollout status available via internal APIs

### Logging
- Application logs are output to stdout/stderr
- In production, these should be captured by your process manager (PM2, Docker, etc.)
- Error logs are also sent to Sentry (if configured)
- Storage nodes can send email alerts for critical resource issues
- Structured logging is implemented for better observability
- Feature flag changes are logged for audit trails

## Backup and Recovery

### Supabase Backup
Supabase provides automated backups of your database and files. 
To create a manual backup:
1. Go to Supabase Dashboard → Backups
2. Click "Create Backup"
3. Wait for completion and download if needed

### Storage Node Data
Storage nodes store files in:
- `./uploads/` - Main storage for media files
- `./uploads/temp/` - Temporary files during upload

To backup:
1. Stop the storage node process
2. Copy the `uploads` directory to backup location
3. Restart the process

To restore:
1. Stop the storage node process
2. Replace the `uploads` directory with backup
3. Restart the process

### Configuration Backup
Backup your `.env` files from:
- `client/` directory (frontend env vars)
- `bot/` directory (storage node env vars)

## Scaling Procedures

### Horizontal Scaling (Adding Storage Nodes)
1. Provision new server/node
2. Install Node.js >= 18.x
3. Copy the `bot/` directory
4. Create `.env` file with appropriate settings:
   - `SUPABASE_URL`: Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY`: Service role key
   - `NODE_URL`: URL that clients will use to reach this node
   - `PORT`: Port to listen on (default 3000)
   - Optional: Storage backend credentials (AWS, R2, etc.)
5. Start the node:
   ```bash
   # Using PM2
   pm2 start bot_server_oracle.js --name "cogallery-storage"
   
   # Or directly
   node bot_server_oracle.js
   ```
6. The node will automatically register itself in the `storage_nodes` table
7. Verify it appears in the Developer Dashboard

### Vertical Scaling (Increasing Resources)
1. Increase CPU/RAM allocation for your servers
2. Restart the storage node processes
3. Monitor performance via `/developer/telemetry` endpoint

## Troubleshooting

### Common Issues and Solutions

#### Storage Node Not Showing in Dashboard
1. Check node logs for connection errors to Supabase
2. Verify `SUPABASE_URL` and `SERVICE_ROLE_KEY` are correct
3. Ensure node can reach Supabase API (network/firewall)
4. Check that `NODE_URL` is set correctly

#### Failed Uploads
1. Check browser console for errors
2. Verify storage node is online (`/status` endpoint)
3. Check storage node logs for error messages
4. Verify available disk space on storage node
5. Check Supabase storage bucket permissions

#### High Resource Usage
1. Check `/developer/telemetry` endpoint for current usage
2. Look for memory leaks in logs
3. Consider scaling up (more RAM/CPU) or out (more nodes)
4. Check for stuck upload processes

#### Database Connection Issues
1. Verify Supabase service is healthy
2. Check rate limiting on Supabase API
3. Ensure service role key has not expired
4. Check network connectivity

### Diagnostic Commands

#### Check Storage Node Status
```bash
curl http://localhost:3000/status
```

#### Get Detailed Metrics
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3000/developer/telemetry
```

#### Test Media Streaming
```bash
curl -I "http://localhost:3000/stream/FILE_ID?t=VALID_TOKEN"
```

## Maintenance Procedures

### Regular Tasks
1. **Daily**: Check storage node logs for errors
2. **Weekly**: Review monitoring dashboards
3. **Monthly**: 
   - Update dependencies (`npm update` in both client and bot directories)
   - Check disk usage and clean old temp files
   - Review security alerts
4. **Quarterly**: 
   - Perform performance review
   - Conduct security audit
   - Test backup and restore procedures

### Cleaning Temporary Files
Storage nodes automatically clean temp files older than 24 hours, but you can manually trigger cleanup:
```bash
# Using developer endpoint (requires auth)
curl -X POST -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
     http://localhost:3000/developer/storage/clear-temp
```

### Updating Software
To update to latest version:
```bash
# In both client and bot directories:
git pull origin main
npm install
# Restart services
```

### Database Migrations
Supabase migrations should be applied through the Supabase Dashboard SQL Editor.
Always backup before running migrations.

## Security Procedures

### Access Control
- Regularly review Supabase auth settings
- Audit API keys and service roles
- Use least privilege principle for API keys

### Vulnerability Scanning
- Run `npm audit` regularly in both client and bot directories
- Keep dependencies updated
- Monitor security advisories for used packages

### Incident Response
1. Identify affected systems
2. Isolate if necessary (network segmentation)
3. Collect logs and evidence
4. Mitigate the issue
5. Notify affected users if required
6. Document lessons learned

## Contact Information
For critical issues, contact the system administrator.

Last Updated: July 6, 2026