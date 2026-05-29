# CoGallery - Project Specification Document

**Version:** 1.0  
**Date:** May 27, 2026  
**Status:** Project Kickoff  
**Project Type:** Permanent Photo Sharing & Archive Platform

---

## 🎯 Executive Summary

**CoGallery** is a permanent photo & video sharing platform designed for trips, events, and group memories. Unlike ephemeral file-sharing apps, CoGallery preserves original-quality media permanently with real-time collaboration during events and sophisticated archive capabilities.

### Problem Statement
Current solutions force users to choose:
- **Temporary** (TextShare, Snapchat): Photos deleted after 1 hour
- **Compressed** (Google Photos, Dropbox): Images optimized/compressed
- **Complex** (AWS, Azure): Enterprise-grade overkill for group sharing

**CoGallery solves this** by offering:
✅ Real-time photo upload during trips
✅ Original quality permanently preserved
✅ Easy group collaboration
✅ Automatic GitHub archive for memory backup
✅ Zero cost at small scale ($0 forever for casual users)

---

## 📋 Core Features

### Phase 1: MVP (Weeks 1-4)
```
✅ Event Creation
   - Create new event/trip
   - Generate shareable code
   - Set privacy (private/public)

✅ Real-Time Photo Upload
   - Direct upload to AWS S3
   - Presigned URLs (no server upload)
   - Progress tracking
   - Batch upload support

✅ Gallery View
   - Thumbnail grid (responsive)
   - Pagination (50 items per page)
   - Real-time updates (new photos appear instantly)
   - Lazy loading

✅ User Management
   - Guest mode (no account needed)
   - Optional sign-up
   - User identification (who uploaded what)
   - Display names

✅ Basic Sharing
   - Share event code
   - QR code generation
   - Event link generation
```

### Phase 2: Features (Weeks 5-8)
```
✅ Metadata & Search
   - EXIF data extraction (date, location, camera)
   - Full-text search on descriptions
   - Filter by uploader
   - Sort by date/uploader

✅ Download Options
   - Download single photo (original quality)
   - Download entire event as ZIP
   - Download filtered selection

✅ Slideshow Mode
   - Auto-play gallery
   - Transition effects
   - Full-screen view

✅ Commenting & Reactions
   - Add comments to photos
   - Like/react to photos
   - Real-time comment sync
```

### Phase 3: Archive & Permanence (Weeks 9-10)
```
✅ GitHub Auto-Archive
   - GitHub Actions workflow
   - Auto-create GitHub repo per event
   - Upload all photos to GitHub
   - Generate static HTML gallery
   - Enable GitHub Pages hosting
   - Share permanent link

✅ Download Package
   - ZIP with metadata
   - HTML version for GitHub
   - JSON manifest (for reimport later)
```

### Phase 4: Polish (Weeks 11-12)
```
✅ Analytics
   - View count per photo
   - Download count
   - Most popular photos

✅ Admin Controls
   - Delete photos
   - Remove users
   - Event privacy settings
   - Set event expiration (optional)

✅ Mobile Optimization
   - App-like experience
   - Offline support (basic)
   - Mobile camera integration
```

---

## 🏗️ Technical Architecture

### Stack Overview
```
┌─────────────────────────────────────────────────────────────┐
│                      FRONTEND LAYER                         │
│  React 18 + TypeScript + Vite + Tailwind CSS               │
│  Hosted: Vercel                                            │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                    REAL-TIME LAYER                          │
│  Supabase Realtime (PostgreSQL LISTEN/NOTIFY)             │
│  WebSocket subscriptions for photo/comment updates        │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   DATABASE LAYER                            │
│  Supabase (PostgreSQL)                                     │
│  - User data                                               │
│  - Events metadata                                         │
│  - Photos metadata                                         │
│  - Comments & reactions                                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   STORAGE LAYER                             │
│  AWS S3 Bucket (Original photo files)                      │
│  - Presigned URLs for direct upload                        │
│  - CloudFront CDN for download delivery                    │
│  - Automatic backups                                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   ARCHIVE LAYER                             │
│  GitHub Pages (Permanent archive)                          │
│  - GitHub Actions for automation                           │
│  - Static HTML gallery generation                          │
│  - Free CDN distribution                                   │
└─────────────────────────────────────────────────────────────┘
```

### Technology Stack
```
Frontend:
├─ React 18.2+
├─ TypeScript 5.3+
├─ Vite 5+
├─ Tailwind CSS
├─ React Query (for data fetching)
├─ Zustand (state management)
└─ react-hot-toast (notifications)

Backend/Real-time:
├─ Supabase (PostgreSQL + Auth + Realtime)
├─ Supabase Client Library
└─ Edge Functions (optional, for processing)

Storage:
├─ AWS S3 (photo storage)
├─ CloudFront (CDN)
└─ AWS SDK v3

Archive:
├─ GitHub Actions
├─ GitHub API
└─ GitHub Pages

Deployment:
├─ Frontend: Vercel
├─ Database: Supabase Cloud
├─ Storage: AWS S3
└─ Archive: GitHub
```

---

## 💾 Database Schema

### Core Tables

#### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  display_name TEXT NOT NULL,
  profile_image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);
```

#### events
```sql
CREATE TABLE events (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  is_public BOOLEAN DEFAULT FALSE,
  event_start_date DATE,
  event_end_date DATE,
  location TEXT,
  cover_photo_id UUID,
  status TEXT DEFAULT 'active', -- active, archived, deleted
  archived_at TIMESTAMPTZ,
  github_repo_url TEXT,
  github_pages_url TEXT
);

CREATE INDEX idx_events_created_by ON events(created_by);
CREATE INDEX idx_events_created_at ON events(created_at DESC);
```

#### photos
```sql
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  file_name TEXT NOT NULL,
  s3_key TEXT NOT NULL UNIQUE,
  file_size INTEGER,
  mime_type TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  uploaded_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Metadata
  exif_data JSONB,
  photo_date DATE,
  location_lat DECIMAL,
  location_lng DECIMAL,
  camera_model TEXT,
  
  -- Display
  thumbnail_s3_key TEXT,
  display_url TEXT,
  
  -- Tracking
  view_count INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0
);

CREATE INDEX idx_photos_event ON photos(event_id);
CREATE INDEX idx_photos_uploader ON photos(uploaded_by);
CREATE INDEX idx_photos_date ON photos(photo_date DESC);
CREATE INDEX idx_photos_uploaded_at ON photos(event_id, uploaded_at DESC);
```

#### comments
```sql
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ
);

CREATE INDEX idx_comments_photo ON comments(photo_id);
```

#### reactions
```sql
CREATE TABLE reactions (
  id UUID PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reaction_type TEXT NOT NULL, -- 'like', 'love', 'laugh', 'wow'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(photo_id, user_id, reaction_type)
);

CREATE INDEX idx_reactions_photo ON reactions(photo_id);
```

#### event_members
```sql
CREATE TABLE event_members (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member', -- 'creator', 'admin', 'member', 'viewer'
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_members_event ON event_members(event_id);
CREATE INDEX idx_event_members_user ON event_members(user_id);
```

---

## 🔌 API Endpoints

### Authentication
```
POST   /api/auth/signup
POST   /api/auth/login
POST   /api/auth/logout
POST   /api/auth/guest          -- Anonymous user creation
GET    /api/auth/user           -- Current user info
```

### Events
```
POST   /api/events              -- Create new event
GET    /api/events              -- List user's events
GET    /api/events/:id          -- Get event details
PUT    /api/events/:id          -- Update event
DELETE /api/events/:id          -- Delete event
POST   /api/events/:id/join     -- Join event with code
```

### Photos
```
POST   /api/events/:id/photos/upload-url    -- Get presigned S3 URL
POST   /api/events/:id/photos/confirm       -- Confirm upload (save metadata)
GET    /api/events/:id/photos               -- Get photos (paginated)
DELETE /api/events/:id/photos/:photoId      -- Delete photo
PUT    /api/events/:id/photos/:photoId      -- Update photo metadata
```

### Downloads
```
GET    /api/events/:id/photos/:photoId/download    -- Download single photo
GET    /api/events/:id/download-zip                -- Download entire event as ZIP
```

### Archive
```
POST   /api/events/:id/archive-to-github    -- Trigger GitHub archival
GET    /api/events/:id/archive-status       -- Check archive progress
```

### Comments & Reactions
```
POST   /api/photos/:id/comments             -- Add comment
DELETE /api/comments/:id                    -- Delete comment
POST   /api/photos/:id/reactions            -- Add reaction
DELETE /api/photos/:id/reactions/:type      -- Remove reaction
```

---

## 🚀 Implementation Roadmap

### Week 1-2: Foundation
- [ ] Set up Supabase project
- [ ] Create PostgreSQL schema (migration)
- [ ] Set up AWS S3 bucket + IAM roles
- [ ] Set up Vercel deployment
- [ ] Create React project structure
- [ ] Implement Supabase auth (guest + email)

### Week 3-4: Core Features
- [ ] Event creation UI
- [ ] Photo upload flow (S3 presigned URLs)
- [ ] Gallery view with real-time sync
- [ ] Basic pagination
- [ ] User identification
- [ ] QR code generation

### Week 5-6: Enhancements
- [ ] EXIF data extraction
- [ ] Metadata storage
- [ ] Search & filter
- [ ] Comments system
- [ ] Reactions system

### Week 7-8: Downloads & Display
- [ ] Single photo download
- [ ] ZIP download functionality
- [ ] Slideshow mode
- [ ] Full-screen viewer

### Week 9-10: Archive Integration
- [ ] GitHub OAuth setup
- [ ] GitHub Actions workflow
- [ ] Auto-create repos
- [ ] Static gallery generation
- [ ] GitHub Pages hosting

### Week 11-12: Polish
- [ ] Mobile optimization
- [ ] Performance tuning
- [ ] Analytics dashboard
- [ ] Error handling
- [ ] Documentation

---

## 💰 Cost Analysis

### Year 1 Breakdown
```
Supabase (PostgreSQL + Auth + Realtime):
  └─ Free tier: $0 (then $25/month if exceeds)
  
AWS S3 + CloudFront:
  └─ ~100 events × 1000 photos × 5MB = 500GB
  └─ Estimated: $20-50/month
  
Vercel (Frontend):
  └─ Free tier for hobby project
  
GitHub (Archive):
  └─ Free (public repos)
  
Total Year 1: $0-50/month ($0-600/year)
```

### Year 5 Projection (with growth)
```
Supabase: $50-100/month
AWS S3 + CloudFront: $100-200/month
Vercel: $0-50/month
GitHub: $0

Total Year 5: $150-350/month ($1,800-4,200/year)
```

---

## 🔐 Security & Privacy

### Data Protection
- All data encrypted in transit (HTTPS/TLS)
- Database encrypted at rest (Supabase default)
- S3 bucket with public-read for photos (user chooses)
- Private events: invitation-only access

### User Authentication
- Supabase JWT tokens
- Optional email verification
- Guest mode for quick sharing
- OAuth ready (Google, GitHub integration)

### Access Control
- Event creators are admins
- Role-based access (creator, admin, member, viewer)
- Soft delete for privacy (archived, not deleted)
- GDPR-compliant data export

---

## 📊 Success Metrics

### Launch Targets (Month 1)
- [ ] 50 concurrent users
- [ ] 100+ events created
- [ ] 10,000+ photos uploaded
- [ ] 99.5% uptime

### Growth Targets (Year 1)
- [ ] 10,000 monthly active users
- [ ] 1,000+ events per month
- [ ] 500,000+ photos stored
- [ ] 4.5+ star rating

---

## 🛠️ Development Notes

### Local Development Setup
```bash
# Clone & install
git clone https://github.com/yourusername/cogallery.git
cd cogallery/client
npm install

# Environment variables
# .env.local
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxxxx
VITE_AWS_REGION=us-east-1

# Run locally
npm run dev
```

### Deployment
```bash
# Frontend to Vercel
vercel deploy

# Database migrations
supabase migration up

# GitHub Actions setup
# Push to repo, Actions run automatically
```

---

## 📝 File Structure
```
cogallery/
├── client/
│   ├── src/
│   │   ├── components/
│   │   │   ├── EventCreate.tsx
│   │   │   ├── GalleryView.tsx
│   │   │   ├── PhotoUpload.tsx
│   │   │   ├── PhotoCard.tsx
│   │   │   ├── EventCard.tsx
│   │   │   ├── Slideshow.tsx
│   │   │   └── ...
│   │   ├── hooks/
│   │   │   ├── useEventLifecycle.ts
│   │   │   ├── usePhotosSubscription.ts
│   │   │   ├── useS3Upload.ts
│   │   │   └── ...
│   │   ├── utils/
│   │   │   ├── supabaseClient.ts
│   │   │   ├── s3Client.ts
│   │   │   ├── exifExtractor.ts
│   │   │   └── ...
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── server/
│   ├── functions/
│   │   ├── onPhotoUpload.ts
│   │   ├── generateThumbnail.ts
│   │   ├── extractMetadata.ts
│   │   └── ...
│   └── index.ts
│
├── supabase/
│   └── migrations/
│       ├── 001_initial_schema.sql
│       ├── 002_indexes.sql
│       └── ...
│
├── .github/
│   └── workflows/
│       ├── archive-to-github.yml
│       └── deploy.yml
│
├── PROJECT_SPEC.md (this file)
├── ARCHITECTURE.md
├── API_DOCS.md
├── SETUP_GUIDE.md
└── README.md
```

---

## ✅ Status: Ready for Development

**Next Steps:**
1. ✅ Architecture finalized
2. ✅ Database schema designed
3. ✅ Tech stack selected
4. ⬜ Begin Week 1 development
5. ⬜ Set up Supabase & AWS
6. ⬜ Create initial project structure

---

**Document Version:** 1.0  
**Last Updated:** May 27, 2026  
**Ready to Begin:** YES ✅
