# CoGallery - IMPROVED Project Specification
## Based on Research & Open-Source Analysis

**Date:** May 27, 2026  
**Status:** Revised (Phase 1 Optimized for Speed)  
**Research Source:** PhotoSwipe, Nextcloud, Piwigo, LibrePhotos, Immich, Figma, GitHub Archive Strategy

---

## 🎯 What Changed from Original Spec

### ✅ Keeps (Validated by Research)
- Real-time photo sync (validated: Immich's WebSocket approach works)
- GitHub Pages permanent archival (unique value prop, no competitor does this)
- Simple guest mode (validated: easier UX than forcing account creation)
- Original quality preservation (market gap exists)
- S3 presigned URLs (standard pattern, avoids backend bottleneck)

### 🔄 Improved/Refined
1. **Schema simplified** (less tables, less complexity)
2. **RBAC model simplified** (owner/editor/viewer instead of complex ACLs)
3. **Real-time tech chosen** (Supabase Realtime proven better than custom)
4. **UI library selected** (PhotoSwipe instead of building custom lightbox)
5. **Async processing added** (thumbnails don't block uploads)
6. **Conflict resolution clarified** (Last-Writer-Wins for LWW, not CRDT)
7. **Deduplication added** (content-hash to prevent re-uploads)
8. **Mobile strategy revised** (focus web MVP, Phase 4 for app)

### ❌ Removed (Identified as Risks)
- Complex permission inheritance (Nextcloud problem)
- ML features in MVP (LibrePhotos warning: too expensive)
- Custom WebSocket implementation (use proven Supabase)
- Yjs dependency consideration (overkill for this use case)
- Event expiration in MVP (Phase 2 feature)
- Partner sharing complexity (Phase 2+ only)

---

## 📋 IMPROVED Core Features

### Phase 1: MVP (Weeks 1-4) — STREAMLINED

#### ✅ Event Creation
- Create event with title + description
- Generate unique 6-char shareable code (e.g., "ABC123")
- Set privacy: private/shared/public
- **NEW:** Content-hash deduplication field in schema
- **NEW:** Archive metadata table for future GitHub integration

#### ✅ Real-Time Photo Upload
- Direct upload to AWS S3 via presigned URLs
- Progress tracking (AWS S3 event callbacks)
- Batch upload support
- **SIMPLIFIED:** Upload immediately, thumbnail async (don't block)
- **NEW:** Duplicate detection (hash-based, client-side warning)
- **NEW:** File size validation (reject 1GB+ files)

#### ✅ Gallery View
- Responsive thumbnail grid (PhotoSwipe-compatible)
- Pagination (50 items/page, configurable)
- Real-time updates via Supabase Realtime
- Lazy loading via intersection observer
- **IMPROVED:** Simple sort (by date, by uploader only)

#### ✅ User Management
- Email signup/login (Supabase Auth)
- Guest mode (no email required, optional display name)
- User display name + avatar from Gravatar
- One role per user: owner/editor/viewer
- **NEW:** Simple audit log (who uploaded what photo)

#### ✅ Basic Sharing
- Share via event code (copy/paste)
- **NEW:** QR code generation (links to web app)
- **NEW:** Share link with expiration (72 hours default)
- Email invite (Phase 2)

---

### Phase 2: Enhancement (Weeks 5-8)

#### ✅ Search & Filter
- Filter by uploader
- Filter by date taken (range picker)
- Full-text search on photo descriptions
- Sort by date/uploader/favorites

#### ✅ Async Image Processing
- Lambda function for thumbnail generation (160px, 320px, 640px)
- WebP format for smaller files
- Progressive JPEG for originals
- Async worker updates DB with thumbnail URLs

#### ✅ Download Options
- Single photo (original quality)
- Selected photos as ZIP
- Entire event as ZIP with metadata JSON
- **IMPROVED:** Include HTML preview in ZIP

#### ✅ Interactions
- Like/react with emoji (❤️, 👍, 🔥, 😂, 🤯, etc)
- Comments on photos
- Real-time sync of reactions/comments
- **NEW:** Conflict resolution via unique (photo_id, user_id, emoji) constraint

#### ✅ Archive Preview
- **NEW:** Archive generation workflow (manual trigger)
- Preview static HTML gallery before pushing to GitHub

---

### Phase 3: Archive & Permanence (Weeks 9-10)

#### ✅ GitHub Auto-Archive
- Manual trigger: "Archive this event"
- GitHub Actions workflow creates repo
- Generates static HTML gallery
- Uploads low-res photos (not full res)
- Enables GitHub Pages
- **NEW:** Archive metadata stored in DB (GitHub URL, date, etc)

#### ✅ Static Gallery
- Standalone HTML file (no JS framework overhead)
- Searchable (client-side, no backend needed)
- Responsive design (mobile-friendly)
- **NEW:** Include JSON manifest for metadata

---

### Phase 4: Polish & Optimization (Weeks 11-12)

#### ✅ Analytics
- View count per photo (from GitHub Pages if available)
- Popular photos ranking
- Event statistics dashboard

#### ✅ Admin Controls
- Delete individual photos
- Soft-delete with recovery (Phase 2+)
- Remove members from event
- Set event expiration
- **SIMPLIFIED:** Owner-only controls (no advanced RBAC)

#### ✅ Mobile Optimization
- Progressive Web App (PWA) manifest
- Offline support (IndexedDB cache)
- Mobile camera integration (Phase 4 only)
- **NOTE:** React Native app in Phase 5+

---

## 🏗️ IMPROVED Technical Architecture

### Tech Stack (REFINED)

| Layer | Technology | Why | Alternative Considered |
|-------|-----------|-----|----------------------|
| **Frontend** | React 18 + TypeScript + Vite | Fast builds, modern | Svelte (overkill) |
| **UI Library** | PhotoSwipe (lightbox) | Battle-tested, 8KB | Custom (too slow) |
| **State Mgmt** | Zustand | Simple, lightweight | Jotai (equivalent) |
| **Real-time** | Supabase Realtime | Included, no setup | Socket.io (overkill), Yjs (too complex) |
| **Database** | Supabase PostgreSQL | Easy RLS, free tier | Firebase (no SQL), MySQL (harder ops) |
| **Auth** | Supabase Auth | Social login ready | Auth0 (cost at scale) |
| **Storage** | AWS S3 + CloudFront | Cheap, reliable | GCS (similar), Azure (vendor lock) |
| **CDN** | CloudFront | Included with S3 | Cloudflare (different pricing) |
| **Image Processing** | AWS Lambda | Scalable, pay-per-use | Self-hosted worker (ops burden) |
| **Archive** | GitHub Actions + Pages | Free forever | Netlify (nice, but not free) |
| **Deploy Frontend** | Vercel | Vercel ↔ GitHub integration | Netlify (similar) |

### Database Schema (OPTIMIZED)

```sql
-- Core tables

CREATE TABLE events (
  id UUID PRIMARY KEY,
  code VARCHAR(6) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id),
  
  privacy VARCHAR(20) NOT NULL CHECK (privacy IN ('private', 'shared', 'public')),
  role_scheme VARCHAR(50) DEFAULT 'simple',  -- 'simple' = owner/editor/viewer
  
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  
  -- Archive metadata
  archived_at TIMESTAMP,
  github_repo_url TEXT,
  github_pages_url TEXT,
  
  INDEX (code),
  INDEX (owner_id),
  INDEX (created_at DESC)
);

CREATE TABLE photos (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id),
  
  filename VARCHAR(255),
  content_hash VARCHAR(64),  -- SHA256, for dedup
  file_size_bytes BIGINT,
  
  -- S3 references
  s3_key TEXT UNIQUE,
  s3_url TEXT NOT NULL,
  thumbnail_url TEXT,  -- updates async
  
  -- EXIF / Metadata
  taken_at TIMESTAMP,
  camera_make VARCHAR(100),
  camera_model VARCHAR(100),
  lens VARCHAR(100),
  iso INT,
  aperture DECIMAL(4,1),
  shutter_speed VARCHAR(20),
  focal_length DECIMAL(5,1),
  
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (event_id),
  INDEX (uploader_id),
  INDEX (content_hash),
  INDEX (taken_at DESC)
);

CREATE TABLE reactions (
  id UUID PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  emoji VARCHAR(10),  -- '👍', '❤️', '🔥'
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(photo_id, user_id, emoji),
  INDEX (photo_id)
);

CREATE TABLE comments (
  id UUID PRIMARY KEY,
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  body TEXT NOT NULL,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (photo_id),
  INDEX (created_at DESC)
);

CREATE TABLE event_members (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id),
  
  role VARCHAR(20) NOT NULL CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(event_id, user_id),
  INDEX (event_id)
);

CREATE TABLE activity_log (
  id UUID PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),  -- NULL for system actions
  
  action VARCHAR(50) NOT NULL,  -- 'photo_uploaded', 'user_invited', 'event_archived'
  object_type VARCHAR(50),  -- 'photo', 'event', 'user'
  object_id UUID,
  
  details JSONB,  -- flexible, action-specific
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (event_id),
  INDEX (created_at DESC)
);
```

### Real-Time Event Types

```typescript
type RealtimeEvent = 
  | { type: 'photo_uploaded', photo: Photo }
  | { type: 'photo_deleted', photoId: UUID }
  | { type: 'reaction_added', photoId: UUID, emoji: string, userId: UUID }
  | { type: 'reaction_removed', photoId: UUID, emoji: string, userId: UUID }
  | { type: 'comment_added', comment: Comment }
  | { type: 'user_invited', userId: UUID, role: string }
  | { type: 'user_left', userId: UUID }
  | { type: 'event_archived', archiveUrl: string }
```

### Conflict Resolution Strategy

**Pattern: Last-Writer-Wins (LWW) + Constraints**

```
Conflict: Two users react with emoji simultaneously
Solution: DB constraint UNIQUE(photo_id, user_id, emoji)
Result: One succeeds, other gets unique constraint violation
Client: Retry, typically succeeds on second attempt

Conflict: Comment edited while syncing
Solution: timestamp + updated_at field
Result: Optimistic update, server might override if different timestamp

Conflict: Photo deleted while user viewing
Solution: Soft delete flag + RLS policy
Result: Photo marked deleted, user sees "This photo was removed"
```

---

## 📊 IMPROVED Architecture Diagram

```
┌──────────────────────────────────────┐
│      React 18 + Vite Frontend        │
│  - Gallery grid (lazy load)          │
│  - PhotoSwipe lightbox               │
│  - Zustand state management          │
│  - Supabase Realtime subscriptions   │
└──────────────┬───────────────────────┘
               │
        ┌──────┴───────┐
        │              │
    [REST]        [WebSocket]
        │              │
        ▼              ▼
┌──────────────────────────────────────┐
│     Supabase (PostgreSQL)            │
│  - Auth (Supabase Auth)              │
│  - Database (schema above)           │
│  - Realtime (LISTEN/NOTIFY)          │
│  - Row-Level Security (RLS)          │
└──────────────┬───────────────────────┘
               │
        ┌──────┴────────────┐
        │                   │
        ▼                   ▼
   ┌─────────┐        ┌──────────┐
   │AWS S3   │        │Lambda    │
   │ ├─ originals          │        │
   │ ├─ thumbnails (async) │ ┌─────▼─────────┐
   │ └─ archives           │ │ Thumbnail Gen │
   └────┬────┘             │ │ (on upload)   │
        │                  │ └───────────────┘
   CloudFront CDN          │
        │                  └─► Update DB
        ▼
   End users (fast)
```

---

## 🎯 IMPROVED Success Metrics

### Month 1 (Launch)
- [ ] 100 concurrent users (was 50)
- [ ] 500 events created (was 100)
- [ ] 50K photos uploaded (was 10K)
- [ ] Real-time sync <500ms latency
- [ ] 99.9% uptime

### 3 Months
- [ ] 2K MAU
- [ ] 500 events/month
- [ ] 500K photos total
- [ ] Archive feature used by 20% of events

### 6 Months
- [ ] 5K MAU
- [ ] 2K events/month
- [ ] 2M photos

### 1 Year
- [ ] 20K MAU (increased from 10K, faster growth via mobile)
- [ ] 5K events/month
- [ ] 10M photos
- [ ] GitHub archive is significant differentiation

---

## ⚡ Key Improvements Summary

### Wins from Research
| Learning | Improvement |
|----------|------------|
| PhotoSwipe battle-tested | Use as dependency for lightbox (save 2 weeks dev) |
| Immich's Realtime WebSocket | Use Supabase Realtime instead of custom (proven, less ops) |
| Piwigo's async processing | Move thumbnail generation to async Lambda (speed up uploads) |
| Figma's LWW approach | Skip CRDT, use simple constraints (less code, same result) |
| Nextcloud's permission model | Simplify to owner/editor/viewer (avoid ACL complexity) |
| Immich's deduplication | Add content-hash for duplicate detection |
| Nextcloud's audit log | Add activity_log table for compliance |

### Risk Mitigation
| Risk | Mitigation |
|------|-----------|
| GitHub ToS violation | Only upload static HTML + low-res thumbnails, not full media |
| Real-time latency | Use Supabase (proven at scale), optimize schema |
| Upload blocking on thumbnails | Generate async, show placeholder |
| Permissions too complex | Keep to 3 roles: owner/editor/viewer |
| Mobile app bottleneck | Web MVP only, mobile Phase 5 |
| S3 costs explode | Content-hash dedup, CloudFront caching |

---

## 🚀 REVISED 12-Week Timeline

### Week 1-2: Foundation
- [ ] Supabase project setup + migrations
- [ ] AWS S3 bucket + IAM roles
- [ ] React + Vite + Tailwind setup
- [ ] Zustand store structure
- [ ] Authentication UI (signup/login/guest)

### Week 3-4: Core MVP
- [ ] Event creation + sharing code
- [ ] Photo upload (presigned URLs)
- [ ] Gallery grid view
- [ ] Supabase Realtime integration
- [ ] QR code generation

### Week 5-6: Interactions
- [ ] Reactions (like/emoji)
- [ ] Comments
- [ ] Real-time sync for both
- [ ] Activity audit log

### Week 7-8: Polish Phase 1
- [ ] Thumbnail async generation (Lambda)
- [ ] Search/filter by uploader + date
- [ ] Bulk download as ZIP
- [ ] Performance optimization
- [ ] Mobile responsive testing

### Week 9-10: Archive Feature
- [ ] GitHub Actions workflow
- [ ] Static HTML gallery generator
- [ ] Archive trigger UI
- [ ] Archive metadata tracking
- [ ] GitHub Pages deployment

### Week 11-12: Launch Prep
- [ ] E2E testing
- [ ] Monitoring/logging setup
- [ ] Security audit (S3 perms, RLS)
- [ ] Documentation
- [ ] Beta testing with 50 users

---

## 💡 Unique Selling Points (Confirmed by Research)

✅ **Permanent GitHub Archive** (no competitor does this)
✅ **Real-time event sharing** (like Immich, not polling)
✅ **Zero cost forever** (GitHub Pages = free)
✅ **No account required** (guest mode = frictionless)
✅ **Original quality** (market gap proven)
✅ **Battle-tested tech stack** (not custom-built)

---

**This spec is now based on proven patterns from 7 major open-source projects and ready for Phase 1 execution.**
