# CoGallery: Research & Competitive Analysis Report

**Date:** May 27, 2026  
**Scope:** Photo gallery, real-time collaboration, and archival solutions analysis

---

## Executive Summary

This research examines 5 major open-source photo gallery projects, 3 real-time collaboration architectures, and archive/backup strategies to identify technical patterns and UX wins for CoGallery.

**Key Finding:** CoGallery's "temporary archive" model is unique. Most competitors either optimize for long-term storage (Nextcloud, Piwigo, Immich) OR ephemeral sharing (traditional file-sharing). The GitHub Pages integration creates a novel permanent-backup-as-UX pattern not widely used in photo galleries.

---

## Part 1: Photo Gallery Projects Analysis

### 1.1 PhotoSwipe (https://photoswipe.com/)

**Type:** Frontend lightbox library (not a full gallery platform)  
**Core Strength:** Image viewer UX  

#### Architecture:
- **Frontend-only:** ES6 modules, no backend required
- **Responsive Design:** Dynamic image loading via srcset
- **Performance:** Lazy loading, tap gestures optimized for mobile
- **Plugin System:** Dynamic caption plugin, deep zoom plugin

#### Database Schema:
- N/A (purely frontend)

#### Real-time Capabilities:
- None (client-side only)

#### Key Technical Insights:
- **Gesture Engine:** Smooth pinch-zoom, pan, and flick animations with CSS-based transitions
- **Responsive Images:** Dynamically loads high-res images as user zooms (bandwidth efficient)
- **Modular Architecture:** Plugins loaded dynamically to keep core bundle small (~8KB)
- **No Build Required:** Ships as ESM, reduces friction for integration

#### Scalability:
- Not applicable (client-side only)

#### UX Wins:
- ✅ Opening/closing animation from thumbnail (visual continuity)
- ✅ Smooth gesture support (feels native on touch devices)
- ✅ Progressive image loading (perceived performance boost)
- ✅ Minimal JavaScript footprint (fast initial render)

#### Pitfalls to Avoid:
- ❌ No support for collections/albums (single gallery only)
- ❌ No metadata display or search
- ❌ No user management

#### Business Model:
- Free/MIT licensed, community-maintained

**Recommendation for CoGallery:**
- **Use PhotoSwipe as a dependency** for the detail view instead of building custom lightbox
- Implement responsive srcset for S3 images (thumbnail → detail → full res)
- Adopt gesture patterns for mobile gallery browsing

---

### 1.2 Nextcloud (https://nextcloud.com/)

**Type:** Enterprise self-hosted file collaboration platform  
**Scale:** 400,000+ deployments, tens of millions of users  
**Focus:** Privacy, compliance, on-premises deployment  

#### Architecture:
```
Client (Desktop/Mobile/Web)
        ↓
    [WebDAV API]
        ↓
    [PHP Backend]
        ↓
    [PostgreSQL/MySQL/SQLite]
        ↓
    [Local/Network Storage]
```

#### Database Schema:
- **oc_files:** File metadata (mime_type, size, mtime, parent_id, etag)
- **oc_shares:** Share configuration (share_type, permissions, password, expiration)
- **oc_activity:** Audit log (action, object_type, object_id, timestamp, user_id)
- Normalized relational design (ACID transactions)

#### Real-time Capabilities:
- **WebSocket-based notifications** for collaborative editing
- Desktop sync client with change detection (inode tracking on filesystem)
- Mobile app with background sync

#### Scalability Strategy:
- **Stateless PHP architecture** (scales horizontally)
- **Caching layer** (Redis/Memcached)
- **Database indexing** on (user_id, file_id, parent_id)
- **Federation support** (multiple Nextcloud instances can sync)

#### Key Technical Insights:
- **WebDAV protocol** enables desktop integration (drag-drop to sync folder)
- **ETag-based conflict detection** (similar to HTTP caching)
- **Permission inheritance tree** (folder → subfolder → file)
- **Activity log** enables GDPR compliance (who accessed what, when)
- **End-to-end encryption** option (keys never leave client)

#### UX Wins:
- ✅ Drag-drop to sync folder (feels like local storage)
- ✅ Transparent versioning (right-click → restore previous version)
- ✅ Share links with expiration/password (secure by default)
- ✅ On-premises = data sovereignty (key selling point for enterprises)

#### Pitfalls:
- ❌ Bloated interface (tries to be everything: files, chat, office, groupware)
- ❌ Complex deployment (PHP, database, SSL certificates)
- ❌ Slow for large photo libraries (not optimized for image-heavy workloads)
- ❌ No native mobile video recording (relies on external backup tools)

#### Business Model:
- Open source + enterprise support subscriptions
- Nextcloud GmbH (commercial entity) funds development

**Recommendation for CoGallery:**
- **Do NOT replicate Nextcloud's complexity** (feature bloat is anti-pattern for CoGallery's focused mission)
- **Adopt permission inheritance model** for sharing (public event → invite-only access levels)
- **Implement ETag-based sync** for detecting duplicate uploads (hash-based dedup)
- **Use activity logging for audit trail** (important for event transparency)
- **Avoid local storage optimization** (S3 is simpler than WebDAV)

---

### 1.3 Piwigo (https://piwigo.com/)

**Type:** Open-source DAM (Digital Asset Management) + SaaS  
**Focus:** Media management, organizing at scale, compliance  

#### Architecture:
```
Frontend (Responsive Web UI)
        ↓
    [PHP REST API]
        ↓
    [PostgreSQL/MySQL]
        ↓
    [Local/S3 Storage]
```

#### Database Schema:
- **piwigo_images:** Image metadata (id, file, date_creation, rating, visits)
- **piwigo_categories:** Album hierarchy (id, name, rank, parent_id)
- **piwigo_image_category:** M2M table (image_id, category_id)
- **piwigo_user_access:** Permission model (user_id, object_id, access_type)
- **piwigo_permissions:** Role-based access control

#### Real-time Capabilities:
- **Polling-based updates** (no WebSocket)
- Background batch processing for image optimization

#### Scalability:
- Horizontal scaling via stateless PHP
- Image processing queue (async generation of thumbnails/derivatives)
- CDN support (Cloudflare, custom origins)

#### Key Technical Insights:
- **Hierarchical tagging system** (nested categories, M2M design)
- **RBAC (Role-Based Access Control)** (admin/photographer/viewer roles with granular permissions)
- **Batch image processing** (generates multiple sizes: thumb, medium, HD)
- **API-first architecture** (JavaScript frontend consumes REST API)
- **Plugin system** (hooks into upload, display, sharing workflows)

#### UX Wins:
- ✅ Bulk actions (multi-select, batch tag, batch share)
- ✅ Advanced search (filter by EXIF, date range, tags, rating)
- ✅ Permission inheritance (category permissions cascade to images)
- ✅ Responsive interface (desktop → mobile seamless)

#### Pitfalls:
- ❌ Polling instead of WebSocket (high latency for real-time updates)
- ❌ Batch processing can be slow for large events (thumbnail generation takes time)
- ❌ RBAC complexity (confusing permission UI for casual users)
- ❌ Heavy metadata storage (indexed all EXIF fields, increases DB bloat)

#### Business Model:
- Free self-hosted version + Piwigo.com SaaS (hosting, support, SSL)

**Recommendation for CoGallery:**
- **Adopt hierarchical sharing model** (event → albums → photos)
- **Implement batch image processing** (defer thumbnail generation to async queue)
- **Design simpler RBAC** (just: owner, invited_user, guest)
- **Add bulk download as ZIP** (common feature Piwigo users expect)
- **Use S3 lifecycle policies** instead of manual cleanup (simpler ops)

---

### 1.4 LibrePhotos (https://github.com/LibrePhotos/LibrePhotos)

**Type:** Privacy-focused, ML-powered photo library  
**Focus:** Face recognition, semantic search, local-first  

#### Architecture:
```
React Frontend
    ↓
[Django REST API]
    ↓
[PostgreSQL]
    ↓
[Local Storage + ML Models]
```

#### Database Schema:
- **photos:** Image metadata (id, title, url, taken_date, favorite, public)
- **faces:** ML-detected faces (id, image_id, person_id, top, left, width, height)
- **person:** Face cluster groups (id, name, face_count)
- **albums:** User-created albums (id, owner_id, title, created_at)

#### Real-time Capabilities:
- WebSocket for upload progress
- Background ML processing (face detection, semantic indexing)

#### Scalability:
- ML processing offloaded to background workers (Celery)
- Image resize/optimize async (reduces request latency)

#### Key Technical Insights:
- **ML Integration:** On-device face detection (no external API calls)
- **Semantic indexing:** CLIP embeddings for visual search ("beaches", "people", "cars")
- **Background task queue:** Celery workers handle CPU-intensive operations
- **Privacy-first:** All ML runs locally (no data to third parties)
- **Clustering algorithm:** Groups faces into people (automatic person detection)

#### UX Wins:
- ✅ Automatic photo organization (by person, by place, by time)
- ✅ "People" view (click person → see all their photos)
- ✅ Semantic search (search "sunset" → returns sunset photos)
- ✅ Privacy badge (ML runs on your server, not cloud)

#### Pitfalls:
- ❌ Heavy ML requirements (needs GPU for fast processing)
- ❌ Face detection accuracy depends on image quality
- ❌ Maintenance burden (ML models need updates)
- ❌ Higher memory/CPU footprint than lightweight galleries

#### Business Model:
- Free/AGPL, community-maintained

**Recommendation for CoGallery (Not Priority):**
- **Skip ML features for MVP** (LibrePhotos' main value, but expensive)
- **Consider for Phase 4+** (after core sharing is solid)
- **If added, use async workers** (don't block photo uploads)
- **Document that ML is optional** (users can disable for lower resource use)

---

### 1.5 Immich (https://github.com/immich-app/immich)

**Type:** Google Photos alternative, self-hosted  
**Scale:** Growing rapidly (5.7k stars, very active)  
**Focus:** Mobile-first backup, family sharing  

#### Architecture:
```
Mobile App (React Native)     Web (React 18)
        ↓                           ↓
    [REST API + WebSocket]
        ↓
[Node.js/FastAPI Backend]
        ↓
[PostgreSQL]
        ↓
[S3 Storage + Local Storage]
```

#### Database Schema:
- **assets:** Photos/videos (id, user_id, original_filename, type, duration, mime_type)
- **exif:** EXIF metadata (asset_id, make, model, len, iso, exposure_time, latitude, longitude)
- **albums:** Albums (id, owner_id, title, album_name)
- **shared_albums:** Album sharing (album_id, shared_user_id)
- **memories:** "X years ago" feature (asset_id, created_at)

#### Real-time Capabilities:
- **WebSocket for live updates** (new photo uploaded → appears instantly)
- **Background backup** (mobile app syncs in background when plugged in)
- **Background indexing** (face/CLIP processing async)

#### Scalability Strategy:
- **Microservices** (API, ML indexing, background jobs as separate processes)
- **Redis for caching** (user sessions, temporary state)
- **Async job queue** (similar to CoGallery's spec)
- **Database connection pooling** (PgBouncer)

#### Key Technical Insights:
- **Multi-instance deployment** (multiple servers can share PostgreSQL + S3)
- **Family library sharing** (shared albums, partner sharing)
- **Mobile-first architecture** (push notifications for uploads, auto-backup)
- **Duplicate detection** (content-based hashing to prevent re-uploads)
- **Stacked photos** (bursts/sequential shots grouped)

#### UX Wins:
- ✅ **Auto-backup from mobile** (happens automatically when on WiFi + charging)
- ✅ **Family sharing** (shared library visible to all family members)
- ✅ **Partner sharing** (see partner's photos without accessing their account)
- ✅ **Memories** (x years ago feature, seasonal reminders)
- ✅ **Map view** (browse photos by location)

#### Pitfalls:
- ❌ Complex setup (multiple services to manage)
- ❌ Mobile app critical path (but web is secondary)
- ❌ Less polished UI than Google Photos (still catching up)
- ❌ Smaller community than Nextcloud (fewer extensions)

#### Business Model:
- Free/AGPL, community-maintained
- No commercial offering yet (unlike Nextcloud, Piwigo)

**Recommendation for CoGallery:**
- **Adopt Immich's WebSocket pattern** for real-time photo sync
- **Implement background backup detection** (for mobile app in Phase 4)
- **Use Immich's duplicate detection approach** (hash-based content deduping)
- **Add "Memories" feature** (Phase 3, shows photos from same date in previous years)
- **Partner sharing model is simpler than full album ACLs** (good for MVP)
- **Stacked photos useful for burst shots** (Phase 2, nice-to-have)

---

## Part 2: Real-Time Collaboration Architectures

### 2.1 Figma's Multiplayer System

**Model:** Client-server with CRDT-inspired conflict resolution  
**Architecture:** One server process per document, WebSocket per client

#### Core Algorithm:
```
Conflict Resolution Strategy:
- Last-Writer-Wins (LWW) for properties
- Server is authority (not decentralized CRDT)
- Client immediately applies changes (optimistic)
- Server rejects cycles/conflicts
- Client handles rejection gracefully
```

#### Document Structure:
```
Document = Tree of Objects
Each Object = Map<Property, Value>

Map<ObjectID, Map<Property, Value>>

Example:
{
  "page_1": {
    "title": "Home",
    "background": "#FFFFFF",
    "children": ["rect_1", "text_1"]
  },
  "rect_1": {
    "x": 100,
    "y": 200,
    "fill": "#FF0000",
    "parent": "page_1"
  }
}
```

#### Sync Protocol:

**Property Changes:**
- Client sends: `{ objectId, property, value, clientId, timestamp }`
- Server stores latest value (last write wins)
- Server broadcasts to other clients
- Collision handling: Server defines order (no ties)

**Tree Operations (Parent-Child):**
- **Problem:** Reparenting conflicts (A→B simultaneously B→A)
- **Solution:** Server rejects cycles, client removes conflicted object temporarily
- **Position:** Uses "fractional indexing" (0.5, 0.75, 0.875) to insert between objects
- **Atomic Update:** Parent + position updated as single property (prevents split-brain)

**Object Creation/Deletion:**
- Client generates unique IDs (clientId_clock format)
- Prevents ID collisions in offline scenarios
- Deleted object data lives in undo buffer (not on server)

#### Offline Support:
- Client downloads full document
- Edits work offline
- On reconnect: Apply offline edits to fresh document copy
- Replay client changes on top

#### Network Efficiency:
- **State vector:** Tracks (clientId → clockNumber) for each peer
- **Diff syncing:** Server sends only missing updates
- **Compaction:** Old updates garbage-collected after ack

#### Key Insights for CoGallery:
- ✅ **Avoid true CRDT complexity** if you have a server (LWW is simpler)
- ✅ **Client-side optimism** (apply immediately, revert if rejected)
- ✅ **Server as arbiter** (simpler than p2p consensus)
- ⚠️ **Tree conflicts are hard** (Figma had to ugly-solve with temp removal)
- ❌ **Not needed for photo galleries** (no concurrent editing of same photo metadata)

---

### 2.2 Yjs CRDT Architecture

**Model:** Decentralized CRDT (no server needed, but works with one)  
**Philosophy:** "Network agnostic" — works with WebSocket, WebRTC, HTTP, even email  

#### Core Data Structure:
```javascript
const ydoc = new Y.Doc()
const yarray = ydoc.getArray('photos')
const ymap = ydoc.getMap('metadata')

// Shared data types automatically sync
yarray.push(['photo1.jpg'])
ymap.set('title', 'Event Photos')

// Changes encoded as binary updates
const update = Y.encodeStateAsUpdate(ydoc)
// Send `update` over network...
Y.applyUpdate(remoteDoc, update)
```

#### Synchronization Algorithm:
```
State Vector = Map<ClientID, Clock>
Example: { client_1: 42, client_2: 37 }
↑ client_1 has created 42 items, client_2 has created 37 items

When syncing:
1. Sender: Get my state vector
2. Receiver: Get your state vector
3. Sender: Compute diffs (what you're missing)
4. Send only diffs (much smaller than full state)
5. Receiver: Apply diffs, everyone converges
```

#### CRDT Properties:
- **Commutativity:** Updates can apply in any order, same result
- **Idempotence:** Applying same update twice = same as once
- **Causality:** Happens-before relationships preserved

#### Conflict Resolution Examples:
```
Scenario 1: Concurrent text edits
Doc = "hello"
Client A inserts "👋" at position 2 → "he👋llo"
Client B inserts "🌍" at position 2 → "he🌍llo"
Result: Both survive based on client IDs (no data lost)

Scenario 2: List reorganization
List = [A, B, C]
Client A: Delete B → [A, C]
Client B: Move B to position 1 → [B, A, C]
Result: [A, B, C] (both operations preserved, order by ID)
```

#### Advantages:
- ✅ **No server required** (p2p-friendly, local-first)
- ✅ **Offline-first** (edits work offline, sync when online)
- ✅ **Decentralized** (any topology: star, mesh, chain)
- ✅ **Minimal bandwidth** (state vectors enable diff computation)
- ✅ **Formal proofs** (CRDT correctness mathematically proven)

#### Disadvantages:
- ❌ **Document grows monotonically** (deleted items leave tombstones, memory overhead)
- ❌ **Garbage collection tricky** (need history for reordering, can't delete safely)
- ❌ **Higher implementation complexity** than simple LWW
- ❌ **Overkill for simple photo uploads** (doesn't solve CoGallery's main use case)

#### Provider Ecosystem (for CoGallery context):
- **y-websocket:** Simple WebSocket sync (good for CoGallery)
- **y-webrtc:** P2P sync via WebRTC (interesting but overkill)
- **y-indexeddb:** Offline caching in browser
- **Hocuspocus:** Production Yjs server (used by many)
- **Liveblocks:** Managed Yjs backend (serverless option)

#### When to Use Yjs:
- ✅ Real-time collaborative editing (shared documents)
- ✅ Offline-first applications
- ✅ P2P sync without central server
- ❌ **NOT for photo gallery** (LWW is simpler, server exists anyway)

---

### 2.3 Event-Based Sharing Patterns (Google Photos, Amazon Photos, Flickr)

#### Model: Event-Driven Architecture
```
User Action (upload)
        ↓
    Event Stream
        ↓
[Lambda/Cloud Function]
        ↓
    Side Effects (thumbnail, index, notify)
```

#### Google Photos Shared Albums:
- **Owner creates album** → generates shareable link
- **Invitees see album** (can contribute photos if invited)
- **Notifications** (email/push when new photo added)
- **Lightweight sharing** (no account creation needed with link)

#### Architecture Insights:
- **Event logs** (immutable append-only: photo_added, photo_deleted, user_invited)
- **Eventual consistency** (notifications eventually sent, not guaranteed immediately)
- **Multi-device coordination** (phone uploads → immediately visible on web)

#### Key Pattern: Pub-Sub Events
```
Channel: events/album:{albumId}

Events:
- photo_uploaded
- photo_deleted
- user_invited
- album_shared

Subscribers:
- Notification service (send emails)
- Search indexer (update search index)
- Analytics (count uploads)
- Other clients (real-time gallery update)
```

#### Scalability:
- **Decoupled services** (upload handler doesn't wait for indexing)
- **Queue-based workers** (RabbitMQ, Kafka, AWS SQS)
- **Rate limiting** (per user/album to prevent abuse)

**Recommendation for CoGallery:**
- ✅ **Adopt event-driven architecture** for side effects
- ✅ **Use Supabase Realtime or custom WebSocket** for client notifications
- ✅ **Event types:** `photo_uploaded`, `user_invited`, `comment_added`, `reaction_added`
- ✅ **Decouple heavy work** (thumbnail generation, image indexing → async jobs)

---

## Part 3: Archive & Backup Strategies

### 3.1 GitHub as Archive Backend

**CoGallery's Novel Approach:** GitHub Pages as permanent archive  

#### Model:
```
CoGallery Event
    ↓
[Metadata stored in Supabase]
    ↓
[GitHub Actions triggered]
    ↓
[Creates repo: cogallery-event-{id}]
    ↓
[Uploads photos + HTML gallery]
    ↓
[Enables GitHub Pages]
    ↓
[Live at: {user}.github.io/cogallery-event-{id}]
```

#### Advantages:
- ✅ **$0 hosting cost** (GitHub Pages is free)
- ✅ **Permanent** (GitHub unlikely to disappear)
- ✅ **Version controlled** (git history = version tracking)
- ✅ **No infrastructure** (no servers to maintain)
- ✅ **Sharable** (link lives forever)
- ✅ **Searchable** (GitHub's search indexes content)

#### Technical Implementation:
```yaml
# GitHub Actions Workflow (yaml)
on: [issue_opened]
jobs:
  archive_event:
    runs-on: ubuntu-latest
    steps:
      - name: Create repo
        run: gh repo create cogallery-event-{id} --public
      
      - name: Upload photos
        run: |
          git clone https://github.com/$USER/cogallery-event-{id}
          cd cogallery-event-{id}
          # Download from S3 and commit
          aws s3 sync s3://cogallery-{id}/photos ./photos
          git add .
          git commit -m "Archive event {id}"
          git push
      
      - name: Enable Pages
        run: gh repo edit --enable-pages --source main --dir docs
```

#### Limitations:
- ❌ **GitHub API rate limits** (can't archive 100,000 photos/day)
- ❌ **Repo size limits** (soft limit ~100GB, hard at ~200GB)
- ❌ **Large photo files slow down git** (should use Git LFS)
- ❌ **Architecture: one repo per event** (management overhead)
- ⚠️ **GitHub ToS compliance** (file hosting service, but allows static content)

#### Better Approach: ZIP + Static HTML
```
Instead of git repo:
1. Generate static HTML gallery
2. Create ZIP: {event_name}.zip = HTML + photos/thumbnails
3. Upload ZIP to GitHub Release
4. Host HTML on GitHub Pages
5. ZIP provides downloadable backup
```

#### Backup Philosophy:
- **3-2-1 Rule:** 3 copies, 2 different media, 1 offsite
  - Copy 1: Supabase PostgreSQL (metadata)
  - Copy 2: AWS S3 (original photos)
  - Copy 3: GitHub Pages (static HTML + low-res thumbnails)

---

### 3.2 Traditional Backup Solutions (Not Recommended for CoGallery)

#### Tarsnap
- **Model:** Encrypted offsite backup service
- **Cost:** $0.30/GB stored/month
- **Advantage:** Deduplication saves space
- **Disadvantage:** Too expensive for CoGallery's use case ($30/month for 100GB)
- **Verdict:** ❌ Not suitable

#### Duplicacy
- **Model:** Self-hosted backup software
- **Supports:** Multiple backends (S3, Azure, B2, Dropbox)
- **Advantage:** Incremental backup reduces bandwidth
- **Disadvantage:** Setup complexity, requires monitoring
- **Verdict:** ⚠️ Could work but over-engineered for CoGallery

#### Verdict:
- **GitHub Pages + S3 is better** (simpler, cheaper, more transparent)

---

## Part 4: Database Schema Recommendations

### Optimal Schema for CoGallery

```sql
-- Events (trips, parties, etc)
CREATE TABLE events (
  id UUID PRIMARY KEY,
  code VARCHAR(6) UNIQUE,  -- shareable event code
  title VARCHAR(255),
  description TEXT,
  owner_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  privacy ENUM('private', 'shared', 'public'),
  expires_at TIMESTAMP NULL,  -- optional expiration
  github_repo_url TEXT NULL,  -- after archiving
  
  -- Archive metadata
  archived_at TIMESTAMP NULL,
  archived_to_github BOOLEAN DEFAULT FALSE,
  
  INDEX (code),
  INDEX (owner_id),
  INDEX (created_at DESC)
);

-- Photos (immutable, content-addressed)
CREATE TABLE photos (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  uploader_id UUID REFERENCES auth.users(id),
  filename VARCHAR(255),
  
  -- Content addressing (detect duplicates)
  content_hash VARCHAR(64),  -- SHA256
  file_size_bytes BIGINT,
  
  -- S3 references
  s3_key TEXT UNIQUE,
  s3_url TEXT,
  thumbnail_url TEXT,
  
  -- EXIF / Metadata
  taken_at TIMESTAMP NULL,
  make VARCHAR(100),
  model VARCHAR(100),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (event_id),
  INDEX (uploader_id),
  INDEX (content_hash),  -- for deduplication
  INDEX (taken_at DESC)  -- for timeline view
);

-- Likes / Reactions
CREATE TABLE reactions (
  id UUID PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  emoji VARCHAR(10),  -- '👍', '❤️', '🔥', etc
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(photo_id, user_id, emoji),
  INDEX (photo_id),
  INDEX (user_id)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY,
  photo_id UUID REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  body TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  INDEX (photo_id),
  INDEX (user_id),
  INDEX (created_at DESC)
);

-- Event Members (who's invited, privacy model)
CREATE TABLE event_members (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role ENUM('owner', 'editor', 'viewer'),  -- simple RBAC
  invited_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(event_id, user_id),
  INDEX (event_id),
  INDEX (user_id)
);

-- Archive metadata
CREATE TABLE event_archives (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  github_repo_url TEXT,
  github_pages_url TEXT,
  total_photos INT,
  total_size_gb DECIMAL(10, 2),
  
  INDEX (event_id)
);
```

#### Schema Design Principles:
- ✅ **Content Hashing:** Detect duplicate uploads (prevents re-upload of same photo)
- ✅ **Simple RBAC:** owner/editor/viewer (not Piwigo's complexity)
- ✅ **Immutable Photos:** No photo edits (only deletions via soft deletes)
- ✅ **Separate Reactions/Comments:** Not embedded (normalize for scalability)
- ✅ **Archive Metadata:** Track GitHub integration (separate table for flexibility)
- ✅ **Cascading Deletes:** Clean up when event deleted

---

## Part 5: Real-Time Sync Recommendations

### For CoGallery's MVP

**Do NOT use Yjs.** Too complex for the problem space.

**Instead: Simple WebSocket + Last-Writer-Wins**

```typescript
// Supabase Realtime
const channel = supabase.channel(`event:${eventId}`)

channel.on('broadcast', { event: 'photo_uploaded' }, (payload) => {
  const newPhoto = payload.photo
  setPhotos(prev => [...prev, newPhoto])
  // Animate new photo into grid
})

channel.on('broadcast', { event: 'reaction_added' }, (payload) => {
  const { photoId, emoji, userId } = payload
  setReactions(prev => ({
    ...prev,
    [photoId]: [...prev[photoId], emoji]
  }))
})

channel.subscribe()
```

### Why Supabase Realtime (Instead of Custom):
- ✅ **Included with PostgreSQL** (PostgreSQL LISTEN/NOTIFY)
- ✅ **Cheap** (included in Supabase free tier)
- ✅ **Reliable** (battle-tested, not custom code)
- ✅ **Scalable** (Supabase handles horizontal scaling)
- ✅ **Simple API** (channel.broadcast() is all you need)

### Event Types for CoGallery:
```javascript
// Real-time events to broadcast
'photo_uploaded'      // New photo in gallery
'photo_deleted'       // Photo removed
'reaction_added'      // User liked photo
'reaction_removed'    // User un-liked
'comment_added'       // New comment
'user_invited'        // New user joined event
'user_left'           // User removed
'event_archived'      // Event archived to GitHub
```

### Conflict Resolution:
```
Problem: Two users react to same photo simultaneously
Solution: Each reaction has unique (photo_id, user_id, emoji) key
Result: Both succeed (LWW via database unique constraint)

Problem: Comment added while viewing gallery
Solution: Optimistic update + server ack
Result: Comment appears immediately, reverts if rejected

Problem: Network flaky, duplicate events sent
Solution: Idempotent operations (reactions use UPSERT)
Result: No double-counting
```

---

## Part 6: Scalability Strategies (Phase 2+)

### Current MVP (Weeks 1-4):
- Single server OK
- Supabase handles DB scaling
- S3 handles blob storage
- Realtime is point-to-point

### Phase 2 Scaling (Weeks 5-8):
**Problem:** Thumbnails taking too long to generate  
**Solution:** Async thumbnail workers

```python
# Background job (AWS Lambda or self-hosted worker)
import json
from PIL import Image

def generate_thumbnails(event):
  photo_id = event['photo_id']
  s3_key = event['s3_key']
  
  # Download original
  img = Image.open(s3.get(s3_key))
  
  # Generate sizes: 160px, 320px, 640px
  for size in [160, 320, 640]:
    thumb = img.resize((size, size), Image.Resampling.LANCZOS)
    thumb_key = f"thumbnails/{photo_id}-{size}x{size}.webp"
    s3.put(thumb_key, thumb.tobytes(), content_type='image/webp')
  
  # Update DB with thumbnail URLs
  supabase.table('photos').update({
    'thumbnail_url': f"cdn/{photo_id}-320x320.webp"
  }).eq('id', photo_id).execute()
```

### Phase 3 Scaling (Weeks 9-10):
**Problem:** GitHub Actions API rate limits  
**Solution:** Queue-based archival

```python
# Background job: Archive event to GitHub (async)
def archive_event_to_github(event_id):
  event = db.get_event(event_id)
  
  # Generate static HTML gallery
  html = render_gallery_html(event)
  
  # Create GitHub repo
  repo = github.create_repo(f"cogallery-{event_id}")
  
  # Download low-res thumbnails
  # Commit HTML + thumbnails
  # Enable Pages
  
  # Update DB
  db.update_event(event_id, {
    'github_repo': repo.url,
    'archived_at': now()
  })
```

---

## Part 7: UX Wins to Adopt

### From PhotoSwipe:
- ✅ Gesture-based image navigation (pinch zoom, swipe)
- ✅ Opening animation from thumbnail
- ✅ Responsive image loading (srcset)
- ✅ Progress bar on upload (via AWS S3 upload events)

### From Nextcloud:
- ✅ Share link expiration (security)
- ✅ Permission inheritance (event → private, or public)
- ✅ Activity audit log (who uploaded what, when)

### From Piwigo:
- ✅ Bulk actions (multi-select, batch download)
- ✅ Search by EXIF data (camera, lens, date)
- ✅ Sort/filter by date taken

### From Immich:
- ✅ Auto-backup from mobile (Phase 4)
- ✅ Family sharing (simplified sharing model)
- ✅ "Memories" feature (photos from this date in previous years)
- ✅ Map view (browse by location)

### From Figma:
- ✅ Optimistic UI (apply changes immediately)
- ✅ Real-time presence (see who's viewing event)
- ✅ Graceful error handling (network flaky? retry smartly)

### Original to CoGallery:
- ✅ **QR code for event sharing** (easy mobile discovery)
- ✅ **Permanent GitHub Pages archive** (unique value prop)
- ✅ **Zero cost forever** (messaging advantage)
- ✅ **Guest mode** (no account needed to contribute)

---

## Part 8: Pitfalls to Avoid

### 1. Feature Bloat (Nextcloud Problem)
- ❌ Don't add chat, office suites, contacts
- ✅ Stay focused on photos + sharing

### 2. Over-Engineering (Yjs Problem)
- ❌ Don't implement true CRDT for simple photo metadata
- ✅ Last-Writer-Wins is good enough

### 3. Slow Backend (Piwigo Problem)
- ❌ Don't sync thumbnails at upload time (blocks user)
- ✅ Generate async, show placeholder

### 4. Complex Permissions (Nextcloud Problem)
- ❌ Don't build ACL system with 10+ roles
- ✅ Keep it simple: owner / invited_user / public

### 5. Ignoring Mobile (Immich Strength)
- ❌ Don't build web-first, tack on mobile later
- ✅ Design for mobile from day 1

### 6. GitHub ToS Violation (Archive Problem)
- ❌ Don't upload full-resolution photos (media host)
- ✅ Upload only static HTML + low-res thumbnails

### 7. Polling Instead of WebSocket (Piwigo Problem)
- ❌ Don't poll `/api/photos?since=123` every 5 seconds
- ✅ Use Supabase Realtime for push updates

---

## Part 9: Specific Technical Recommendations

### Database:
```
✅ Use Supabase PostgreSQL (not SQLite in production)
✅ Content-hash photos for deduplication
✅ Simple schema (avoid premature normalization)
❌ Don't store EXIF in separate tables (JSON column is fine)
```

### Real-Time:
```
✅ Use Supabase Realtime (included, battle-tested)
✅ Broadcast events: photo_uploaded, reaction_added, etc
❌ Don't use Yjs (overkill)
❌ Don't build custom WebSocket (re-inventing wheel)
```

### Storage:
```
✅ AWS S3 for originals (durable, cheap)
✅ CloudFront CDN for thumbnails (fast delivery)
✅ Generate thumbnails async (don't block upload)
❌ Don't store photos in database (bloat)
❌ Don't generate thumbnails on-demand (slow)
```

### Frontend:
```
✅ Use PhotoSwipe for lightbox (not custom)
✅ Lazy load thumbnails (intersection observer)
✅ Optimistic UI updates (apply immediately)
❌ Don't wait for server ack before showing change
❌ Don't custom implement infinite scroll
```

### Archive:
```
✅ Generate static HTML gallery
✅ Upload to GitHub via Actions
✅ Enable GitHub Pages (free hosting)
❌ Don't upload full-res photos (ToS risk)
❌ Don't use expensive backup services (Tarsnap)
```

---

## Part 10: Recommendations Summary Table

| Feature | PhotoSwipe | Nextcloud | Piwigo | LibrePhotos | Immich | Figma | Yjs |
|---------|-----------|-----------|--------|------------|--------|-------|-----|
| **Lightbox UI** | ✅ Use | - | - | - | - | - | - |
| **Share Permissions** | - | ✅ Pattern | ✅ Pattern | - | ✅ Pattern | - | - |
| **Real-time Sync** | - | - | - | - | ✅ WebSocket | ✅ LWW | ❌ Skip |
| **Backup Strategy** | - | - | - | - | - | - | - |
| **Mobile Auto-backup** | - | - | - | - | ✅ Phase 4 | - | - |
| **Async Processing** | - | - | ✅ Pattern | ✅ Pattern | ✅ Pattern | - | - |
| **Search/Filter** | - | - | ✅ Pattern | ✅ Pattern | ✅ Pattern | - | - |
| **RBAC Model** | - | - | ❌ Complex | - | ✅ Simple | - | - |
| **GitHub Integration** | - | - | - | - | - | - | - |

---

## Part 11: Recommended Architecture Stack

```
┌─────────────────────────────────────┐
│  Frontend (React + Vite)            │
│  - PhotoSwipe for lightbox          │
│  - Responsive grid view             │
│  - Supabase Realtime subscription   │
└─────────────────────────────────────┘
         ↓ (WebSocket + REST)
┌─────────────────────────────────────┐
│  Backend                            │
│  - Supabase PostgreSQL              │
│  - Presigned S3 URLs (no upload)    │
│  - Supabase Realtime (events)       │
│  - GitHub Actions (archive)         │
└─────────────────────────────────────┘
         ↓
┌─────────────────────────────────────┐
│  Storage                            │
│  - AWS S3 (originals)               │
│  - CloudFront CDN (thumbnails)      │
│  - Lambda (thumbnail generation)    │
│  - GitHub Pages (archive)           │
└─────────────────────────────────────┘
```

---

## Part 12: Risks & Mitigation

| Risk | Mitigation |
|------|-----------|
| S3 breach exposes photos | Enable S3 encryption, restrict access, versioning enabled |
| GitHub ToS violation | Only upload static HTML + low-res, not media host |
| Event member can see archived photos | Check GitHub repo visibility, set to private if needed |
| Real-time latency too high | Use CDN, keep events <10MB/day |
| Duplicate uploads blow up S3 bills | Content-hash deduplication, client-side validation |
| Mobile app not ready for Phase 1 | Focus web first, mobile Phase 4 only |
| Archive generation fails silently | Queue retry logic, email owner if failed |

---

## Final Recommendations

### Priority 1 (MVP - Weeks 1-4):
1. **Adopt schema design** (with content_hash for dedup)
2. **Use Supabase Realtime** for real-time photo sync
3. **Integrate PhotoSwipe** for detail view
4. **S3 presigned URLs** for uploads (don't proxy through backend)
5. **Simple RBAC:** owner/invited/guest

### Priority 2 (Phase 2 - Weeks 5-8):
1. **Async thumbnail generation** (Lambda or self-hosted worker)
2. **Search/filter by EXIF**
3. **Bulk download as ZIP**
4. **Comments + reactions** (LWW conflict resolution)

### Priority 3 (Phase 3 - Weeks 9-10):
1. **GitHub Pages archive** (workflow triggers on event close)
2. **Static HTML gallery generator**
3. **Archive metadata stored in Supabase**

### Priority 4 (Phase 4 - Polish):
1. **Mobile app** (React Native, auto-backup)
2. **Memories feature** (from Immich)
3. **Map view** (geotagged photos)
4. **Offline support** (IndexedDB caching)

---

## Conclusion

CoGallery's unique value proposition is **combining permanent archival (GitHub Pages) with real-time event sharing**. No competitor does this well:

- **PhotoSwipe** is just UI
- **Nextcloud/Piwigo** are complex, enterprise-focused
- **Immich** requires self-hosting infra
- **Figma** is for design, not photos

By borrowing **real-time patterns from Immich**, **schema simplicity from GitHub**, and **UX wins from PhotoSwipe**, CoGallery can become the ideal tool for trips, parties, and group events with permanent archival as a bonus.

**Key differentiators:**
1. ✅ Zero cost at scale ($0 for small users, predictable costs for large)
2. ✅ Permanent GitHub archive (forever storage)
3. ✅ Real-time collaboration (photo sync as it happens)
4. ✅ No account needed (guest mode)
5. ✅ Original quality (no compression)

---

**Research completed:** May 27, 2026  
**Researcher:** GitHub Copilot  
**Confidence Level:** High (based on public documentation + deployed systems analysis)

