# CoGallery Deployment Guide

Taking CoGallery to production involves three main components: **Supabase** (Database/Auth), **Vercel** (Frontend), and **Oracle Backend** (Storage/Processing Nodes).

This guide has been enhanced with state-of-the-art optimizations including:
- Virtualized photo grids for efficient rendering of large collections
- Centralized logging with Sentry integration
- Feature flag system for gradual rollouts
- Web Workers for offloading CPU-intensive tasks (SHA-256 hashing)
- Background sync for reliable offline operations

## 1. Supabase Production Setup

### A. Environment Configuration
1. Create a new project in the Supabase Dashboard for production (do not use your dev environment).
2. Note your **Project URL** and **anon public API key**.

### B. Database Migration
Instead of running individual SQL scripts, run them in the following order in the Supabase SQL Editor:
1. `SCHEMA_MIGRATION_HIERARCHICAL.sql` (Base tables: Users, Rooms, Events, Photos, Memberships, Activity Log)
2. `RLS_POLICIES_HIERARCHICAL.sql` (Initial Row Level Security Policies)
3. `FIX_RLS_POLICIES_FINAL.sql` (Patches and recursive query fixes)
4. `ADD_DELETION_THUMBNAILS.sql` (Adds `thumbnail_url` columns and deletion functionality)
5. `ADD_SOCIAL_ENGAGEMENT.sql` (Adds `reactions` and `comments` tables + RLS)
6. `ADD_AVATARS_BUCKET.sql` (Creates the avatars bucket)

### C. Storage Buckets
Ensure the following buckets exist in the Supabase Storage dashboard and are set to **Public**:
- `photos`
- `avatars`

### D. Authentication
1. Go to **Authentication > Providers** and ensure Email is enabled.
2. Under **Authentication > URL Configuration**, set your **Site URL** to your production domain (e.g., `https://cogallery.com`).
3. Add any necessary redirect URLs (e.g., `https://cogallery.com/auth/callback`).

## 2. Vercel Frontend Deployment

### A. Preparation
1. Ensure your code is pushed to a GitHub repository.
2. The project uses Vite, so the build command is `npm run build` and the output directory is `dist`.

### B. Deploying to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Vercel should automatically detect that this is a **Vite** project.
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Expand the **Environment Variables** section and add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key
   - `VITE_SENTRY_DSN`: (Optional) Your Sentry DSN for error tracking

### C. Launch
1. Click **Deploy**.
2. Once the build finishes, Vercel will assign a `.vercel.app` domain. 
3. If you have a custom domain, go to the project's **Settings > Domains** in Vercel to attach it.

## 3. Oracle Backend (Storage Node) Deployment

The Oracle backend handles media storage, processing, and distribution. It can be deployed on any Node.js-compatible host (VPS, Docker, Kubernetes, etc.).

### A. Prerequisites
1. Node.js >= 18.x
2. Supabase project URL and service role key (from your Supabase project)
3. Supabase JWT secret (found in Settings -> Settings -> JWT Settings)
4. Optional: S3-compatible storage credentials (AWS S3, Cloudflare R2, etc.) for external storage

### B. Environment Configuration
Create a `.env` file in the `bot/` directory with the following variables:

```env
# Supabase Configuration
SUPABASE_URL=your_supabase_project_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key (used for client-side operations)
SUPABASE_JWT_SECRET=your_supabase_jwt_secret

# Storage Configuration (Optional - defaults to local disk)
# For S3-compatible storage (AWS S3, Cloudflare R2, etc.):
# AWS_ACCESS_KEY_ID=your_access_key
# AWS_SECRET_ACCESS_KEY=your_secret_key
# AWS_S3_BUCKET=your_bucket_name
# AWS_S3_REGION=your_region
# AWS_S3_ENDPOINT=your_endpoint (if not AWS, e.g., for Cloudflare R2)

# Server Configuration
PORT=3000
NODE_URL=http://your-domain.com (used for health checks and self-registration)
STREAM_JWT_SECRET=your_stream_jwt_secret (can be same as SUPABASE_JWT_SECRET)
STREAM_TOKEN_TTL=15m

# Monitoring & Alerts (Optional)
RESEND_API_KEY=your_resend_api_key (for error alerts)
ALERT_EMAIL_ADDRESS=your_email_for_alerts
```

### C. Installation & Setup
1. Clone the repository to your server
2. Navigate to the `bot/` directory
3. Install dependencies: `npm install`
4. Build the application: `npm run build` (if using TypeScript build)
5. Start the server:
   - For development: `npm start`
   - For production (using PM2): `pm2 start bot_server_oracle.js --name "cogallery-storage"`
   - For production (using Docker): See Docker section below

### D. Docker Deployment (Recommended for Production)

#### Dockerfile
```dockerfile
# Use Node.js 18 as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY . .

# Build TypeScript (if applicable)
RUN npm run build

# Expose port
EXPOSE 3000

# Create non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nextjs -u 1001
USER nextjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/status || exit 1

# Start the application
CMD ["node", "bot_server_oracle.js"]
```

#### docker-compose.yml
```yaml
version: '3.8'

services:
  cogallery-bot:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/status"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    volumes:
      - ./uploads:/app/uploads  # Persistent storage for media files
      - ./uploads/temp:/app/uploads/temp  # Temporary upload processing
```

#### Running with Docker Compose
```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f

# Stop and remove
docker-compose down
```

### E. Kubernetes Deployment

#### Deployment Configuration (deployment.yaml)
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: cogallery-bot
  labels:
    app: cogallery-bot
spec:
  replicas: 3
  selector:
    matchLabels:
      app: cogallery-bot
  template:
    metadata:
      labels:
        app: cogallery-bot
    spec:
      containers:
      - name: cogallery-bot
        image: cogallery-bot:latest
        ports:
        - containerPort: 3000
        envFrom:
        - secretRef:
            name: cogallery-secret
        - configMapRef:
            name: cogallery-config
        volumeMounts:
        - name: storage
          mountPath: /app/uploads
        - name: tmp-storage
          mountPath: /app/uploads/temp
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /status
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /status
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
      volumes:
      - name: storage
        persistentVolumeClaim:
          claimName: cogallery-storage-pvc
      - name: tmp-storage
        emptyDir: {}
```

#### Service Configuration (service.yaml)
```yaml
apiVersion: v1
kind: Service
metadata:
  name: cogallery-bot-service
spec:
  selector:
    app: cogallery-bot
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
  type: LoadBalancer
```

#### Persistent Volume Claim (pvc.yaml)
```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: cogallery-storage-pvc
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
  storageClassName: standard
```

#### Secret and ConfigMap (optional)
```yaml
# secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: cogallery-secret
type: Opaque
data:
  SUPABASE_URL: <base64-encoded>
  SUPABASE_SERVICE_ROLE_KEY: <base64-encoded>
  SUPABASE_JWT_SECRET: <base64-encoded>
  STREAM_JWT_SECRET: <base64-encoded>

# configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: cogallery-config
data:
  PORT: "3000"
  NODE_URL: "http://your-cluster-domain"
  STREAM_TOKEN_TTL: "15m"
```

#### Applying Kubernetes Resources
```bash
# Apply all configurations
kubectl apply -f k8s/

# Or apply individually
kubectl apply -f k8s/pvc.yaml
kubectl.apply -f k8s/secret.yaml
kubectl.apply -f k8s/configmap.yaml
kubectl.apply -f k8s/deployment.yaml
kubectl.apply -f k8s/service.yaml
```

### F. Verification
Once deployed, verify the node is working by:
1. Accessing the health endpoint: `http://your-server-ip:3000/status` (should return `{ "status": "online", "service": "CoGallery Oracle Backend" }`)
2. Checking the logs for any errors
3. Verifying in the Developer Dashboard that the node appears as online
4. For Kubernetes: `kubectl get pods` should show your pods in Running state

## 4. Post-Deployment Checklist

- [ ] **Test Auth:** Try signing up, logging in, and resetting a password on the live site.
- [ ] **Test Uploads:** Upload a photo and confirm it saves to the storage bucket.
- [ ] **Test Storage Node Health:** Visit `http://your-storage-node-ip:3000/status` to confirm the backend is online.
- [ ] **Test Media Streaming:** Upload a video and verify it plays correctly via the streaming endpoint.
- [ ] **Test Avatars:** Go to Profile Settings and change the avatar to confirm the `avatars` bucket policies are working.
- [ ] **Test Batch Download:** Ensure the "Download All" `.zip` generation doesn't crash the browser on production.
- [ ] **Test Invites:** Copy an invite link and open it in an incognito window to verify routing.
- [ ] **Test Developer Dashboard:** Access `/developer/telemetry` on your storage node to verify admin endpoints work (requires authentication).
- [ ] **Monitor Logs:** Check both frontend and backend logs for any errors during initial usage.
- [ ] **Test Health Endpoints:** Verify `/status` and `/metrics` endpoints are responding correctly.
- [ ] **Test Docker Healthcheck:** If using Docker, verify health checks are passing with `docker ps`.

## 5. Scaling Considerations

### Horizontal Scaling (Multiple Storage Nodes)
1. Deploy additional instances of the bot server following the same procedure
2. Ensure each node has a unique `NODE_URL` environment variable
3. All nodes will automatically register themselves in the `storage_nodes` table in Supabase
4. The frontend will automatically distribute requests across all healthy nodes
5. For Kubernetes, simply increase the `replicas` count in your Deployment

### Vertical Scaling
1. Increase the resources (CPU/RAM) allocated to your bot server instances
2. Monitor performance using the `/developer/telemetry` endpoint
3. Adjust worker counts and timeouts as needed based on your workload
4. In Docker/Kubernetes, update resource limits in your configuration

## 7. Advanced Features & Optimizations

CoGallery includes several state-of-the-art optimizations that should be verified after deployment:

### A. Virtualized Photo Grid
For galleries with 100+ photos, CoGallery uses a virtualized grid implementation that only renders visible items:
- Feature flag: `enhancedPhotoGrid` (enable in feature flags)
- Automatically activates for galleries > 20 items
- Significantly improves scroll performance and memory usage
- Verify by loading a large gallery and monitoring DOM element count

### B. Centralized Logging
Client-side logging is centralized with environment-aware levels:
- Development: Logs all levels to console
- Production: Only warnings and errors to console, errors sent to Sentry
- Verify by checking console logs in development and Sentry dashboard in production
- Logger service located at `client/src/lib/logger.ts`

### C. Feature Flag System
New features can be gradually rolled out using the feature flag system:
- Flags managed via `client/src/lib/featureFlags.ts`
- Default flags include: `enhancedPhotoGrid`, `advancedHashing`, `enhancedUploads`
- Can be toggled at runtime without redeployment
- Verify by checking the feature flags endpoint or using the developer dashboard

### D. Web Workers for CPU-Intensive Tasks
SHA-256 hashing for file deduplication is offloaded to Web Workers:
- Worker located at `client/src/lib/workers/hashWorker.ts`
- Processes files in chunks to prevent UI blocking
- Used in upload queue service for deduplication
- Verify by monitoring CPU usage during large file uploads (should remain low)

### E. Background Sync & Offline Support
Upload queue persists through network interruptions:
- Uses IndexedDB via uploadQueueService
- Automatically retries failed uploads when connectivity resumes
- Verify by disabling network during upload and reconnecting

### F. Performance Monitoring
- Frontend: Web Vitals monitoring integrated with Sentry
- Backend: Prometheus-compatible metrics at `/metrics` endpoint
- Health checks: `/status` endpoint returns service status

## 8. Verification Checklist

### Frontend Verification
- [ ] Homepage loads and shows galleries
- [ ] User authentication works (login/logout)
- [ ] Photo upload completes successfully
- [ ] Virtual grid activates for galleries >20 photos (check DOM count)
- [ ] Logging appears in browser console (dev) or Sentry (prod)
- [ ] Feature flags accessible via developer tools

### Backend Verification
- [ ] Health endpoint responds: `http://your-storage-node:3000/status`
- [ ] Metrics endpoint available: `http://your-storage-node:3000/metrics`
- [ ] Worker node appears in Developer Dashboard as online
- [ ] File uploads complete and are accessible
- [ ] Deleted files are removed from storage
- [ ] Avatar uploads work correctly

### Advanced Features Verification
- [ ] Large gallery (>100 photos) renders smoothly without lag
- [ ] Upload progress visible during network interruptions
- [ ] Duplicate file detection works (same file uploaded twice)
- [ ] Feature flags can be toggled without redeploy
- [ ] Error reporting works (test with console.error in dev mode)

## 6. Maintenance

### Regular Tasks
1. **Monitor Storage:** Use the `/developer/storage/*` endpoints to clean up temporary files and old uploads
2. **Check Logs:** Regularly review logs for errors or warnings
3. **Update Dependencies:** Periodically run `npm update` in both client and bot directories
4. **Backup Configuration:** Keep secure backups of your `.env` files and Supabase project settings
5. **Monitor Metrics:** Scrape the `/metrics` endpoint with Prometheus for monitoring and alerting

### Updates
1. To update the bot server:
   ```bash
   git pull origin main
   npm install
   pm2 restart cogallery-storage  # or restart your Docker container
   ```
2. To update the frontend:
   - Push changes to your GitHub repository
   - Vercel will automatically detect and deploy the changes

### Backup and Disaster Recovery
1. Regularly backup your Supabase database using their built-in backup tools
2. Backup your `.env` files and any custom configuration
3. For persistent storage volumes, implement snapshot-based backups
4. Test your recovery procedures periodically

---
*Note: For detailed architecture information, see the ARCHITECTURE.md file.*