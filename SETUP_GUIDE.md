# CoGallery - Complete Setup Guide

## Prerequisites

Before starting, ensure you have:

- Node.js 18+ (`node --version`)
- Git (`git --version`)
- npm or yarn (`npm --version`)
- A GitHub account (for archival feature)
- AWS account (for S3 bucket)
- Supabase account (free tier available)

---

## Step 1: Local Development Environment

### 1.1 Clone and Setup Project

```bash
# Clone repository
git clone https://github.com/yourusername/cogallery.git
cd cogallery

# Install frontend dependencies
cd client
npm install

# Install server dependencies (optional)
cd ../server
npm install

# Back to root
cd ..
```

### 1.2 Create Environment Files

**`client/.env.local`**
```env
# Supabase Configuration
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx

# AWS Configuration
VITE_AWS_REGION=us-east-1
VITE_AWS_ACCESS_KEY_ID=AKIA...
VITE_AWS_SECRET_ACCESS_KEY=...
VITE_AWS_S3_BUCKET=cogallery-photos

# GitHub Configuration (optional)
VITE_GITHUB_TOKEN=ghp_...
VITE_GITHUB_USERNAME=yourname

# App Configuration
VITE_APP_URL=http://localhost:5173
VITE_API_URL=http://localhost:3000
```

**`server/.env`**
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cogallery

# AWS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_S3_BUCKET=cogallery-photos

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_KEY=xxxxx

# GitHub
GITHUB_TOKEN=ghp_...
GITHUB_USERNAME=yourname
```

---

## Step 2: Supabase Setup

### 2.1 Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Choose organization and enter:
   - Project name: `cogallery`
   - Database password: (save securely)
   - Region: Choose closest to you
4. Click "Create new project"
5. Wait 2-3 minutes for initialization

### 2.2 Get Supabase Credentials

1. Go to Project Settings → API
2. Copy:
   - `Project URL` → `VITE_SUPABASE_URL`
   - `anon public` key → `VITE_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_KEY` (keep secret!)

### 2.3 Create Database Schema

1. Go to SQL Editor in Supabase
2. Create new query
3. Paste contents of `supabase/migrations/001_initial_schema.sql`
4. Click "Run"
5. Repeat for `002_indexes.sql`, `003_rls_policies.sql`

**Or use migration tool:**
```bash
supabase migration up
```

### 2.4 Enable Row Level Security

```sql
-- Run in Supabase SQL Editor

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;

-- Create policies (see ARCHITECTURE.md for examples)
```

### 2.5 Enable Real-Time

1. Go to Supabase Dashboard
2. Replication → Select tables to enable real-time
3. Enable:
   - `photos`
   - `comments`
   - `reactions`
4. Save

---

## Step 3: AWS Setup

### 3.1 Create S3 Bucket

1. Go to [AWS Console](https://console.aws.amazon.com)
2. Search for "S3"
3. Click "Create bucket"
4. Name: `cogallery-photos-{random}`
5. Region: Choose closest to you
6. Block all public access: **Uncheck** (for CDN)
7. Create

### 3.2 Create CloudFront Distribution

1. Go to CloudFront in AWS Console
2. Create distribution
3. Origin: Select your S3 bucket
4. Allowed HTTP methods: GET, HEAD, PUT, POST, PATCH, DELETE, OPTIONS
5. Cache policy: Managed-CachingOptimized (1 year TTL)
6. Create

### 3.3 Create IAM User

1. Go to IAM → Users
2. Create user: `cogallery-app`
3. Attach policy: `AmazonS3FullAccess` (or custom)
4. Create access key (save `Access Key ID` and `Secret Access Key`)
5. Update `.env` files

### 3.4 Enable S3 Versioning & Lifecycle

```bash
# Enable versioning
aws s3api put-bucket-versioning \
  --bucket cogallery-photos-{name} \
  --versioning-configuration Status=Enabled

# Enable backups (optional)
aws s3api put-bucket-lifecycle-configuration \
  --bucket cogallery-photos-{name} \
  --lifecycle-configuration file://lifecycle-config.json
```

---

## Step 4: Frontend Development

### 4.1 Start Development Server

```bash
cd client
npm run dev
```

Open http://localhost:5173

### 4.2 Project Structure

```
client/
├── src/
│   ├── components/
│   │   ├── EventCreate.tsx
│   │   ├── GalleryView.tsx
│   │   ├── PhotoUpload.tsx
│   │   ├── PhotoCard.tsx
│   │   └── ...
│   ├── hooks/
│   │   ├── useEventLifecycle.ts
│   │   ├── usePhotosSubscription.ts
│   │   └── ...
│   ├── utils/
│   │   ├── supabaseClient.ts
│   │   ├── s3Client.ts
│   │   └── ...
│   ├── App.tsx
│   ├── main.tsx
│   └── index.css
├── public/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

### 4.3 Key Components

**Supabase Client (`src/utils/supabaseClient.ts`):**
```typescript
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
```

**S3 Client (`src/utils/s3Client.ts`):**
```typescript
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'

export const s3Client = new S3Client({
  region: import.meta.env.VITE_AWS_REGION,
  credentials: {
    accessKeyId: import.meta.env.VITE_AWS_ACCESS_KEY_ID,
    secretAccessKey: import.meta.env.VITE_AWS_SECRET_ACCESS_KEY,
  }
})
```

---

## Step 5: Backend Setup (Optional)

### 5.1 Server Implementation

If deploying with backend processing:

```bash
cd server
npm install express dotenv cors aws-sdk supabase
npm run dev
```

### 5.2 Required Endpoints

- `POST /upload-url` - Get presigned S3 URL
- `POST /confirm-upload` - Save metadata
- `POST /archive-to-github` - Trigger GitHub archival
- `GET /health` - Health check

---

## Step 6: Deployment

### 6.1 Deploy Frontend to Vercel

```bash
npm install -g vercel

# Login
vercel login

# Deploy
cd client
vercel

# Add environment variables:
# VITE_SUPABASE_URL
# VITE_SUPABASE_ANON_KEY
# VITE_AWS_*
```

### 6.2 Deploy Database Migrations

```bash
# Supabase automatically handles migrations
# Or use CLI:
supabase db push

# Verify in Supabase dashboard
```

### 6.3 Setup GitHub Actions

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: vercel/action@v4
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
```

---

## Step 7: GitHub Integration (Archive Feature)

### 7.1 Create GitHub OAuth App

1. Go to GitHub Settings → Developer settings → OAuth Apps
2. Click "New OAuth App"
3. Application name: `CoGallery`
4. Homepage URL: `https://cogallery.app`
5. Callback URL: `https://cogallery.app/auth/github/callback`
6. Copy `Client ID` and `Client Secret`

### 7.2 Setup GitHub Token

```bash
# Generate personal access token
# Settings → Developer settings → Personal access tokens → Generate new token
# Scopes: repo, workflow

# Add to environment:
VITE_GITHUB_TOKEN=ghp_...
```

---

## Step 8: Testing

### 8.1 Local Testing

```bash
# Frontend tests
cd client
npm run test

# E2E tests
npm run test:e2e

# Type checking
npm run typecheck
```

### 8.2 Manual Testing Checklist

- [ ] Create account / login
- [ ] Create new event
- [ ] Upload photo
- [ ] See photo in gallery (real-time)
- [ ] Add comment
- [ ] Add reaction
- [ ] Download single photo
- [ ] Download as ZIP
- [ ] Archive to GitHub
- [ ] Access GitHub Pages

---

## Step 9: Production Checklist

Before going live:

- [ ] Enable authentication verification
- [ ] Enable HTTPS everywhere
- [ ] Set CORS properly
- [ ] Enable database backups
- [ ] Configure S3 lifecycle policies
- [ ] Setup CloudFront logging
- [ ] Enable Sentry error tracking
- [ ] Setup monitoring/alerts
- [ ] Document API endpoints
- [ ] Create user documentation
- [ ] Test with 100+ concurrent users
- [ ] Verify backup/recovery process

---

## Troubleshooting

### Issue: "Database connection refused"
```bash
# Check Supabase is online
curl https://xxxxx.supabase.co/rest/v1/

# Check credentials in .env
```

### Issue: "S3 bucket access denied"
```bash
# Check IAM permissions
# Verify bucket name matches .env
# Check AWS credentials are correct
```

### Issue: "Real-time updates not working"
```bash
# Check RLS policies allow your user
# Verify table is enabled for real-time
# Check WebSocket connection in browser DevTools
```

### Issue: "GitHub archival fails"
```bash
# Check GitHub token is valid
# Check token has 'repo' scope
# Verify username in .env
```

---

## Useful Commands

```bash
# Database
supabase db reset              # Reset database
supabase migration new         # Create new migration
supabase db push              # Apply migrations

# Frontend
npm run dev                    # Start dev server
npm run build                  # Build for production
npm run preview               # Preview production build
npm run lint                  # Lint code

# Deployment
vercel                        # Deploy to Vercel
vercel env pull              # Pull environment variables
```

---

## Next Steps

1. ✅ Complete setup above
2. ⬜ Review [PROJECT_SPEC.md](./PROJECT_SPEC.md)
3. ⬜ Review [ARCHITECTURE.md](./ARCHITECTURE.md)
4. ⬜ Begin Week 1 development
5. ⬜ Implement core features (see PROJECT_SPEC.md Phase 1)

---

**Setup Guide Version:** 1.0  
**Last Updated:** May 27, 2026  
**Status:** Ready for Development ✅
