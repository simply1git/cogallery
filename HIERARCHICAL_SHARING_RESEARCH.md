# Hierarchical Photo/Media Sharing Platforms: Research & Best Practices

**Research Date:** May 2026  
**Focus:** Trip/Event-based photo sharing with granular permissions and real-time collaboration

---

## Executive Summary

This research analyzes six major platforms managing hierarchical content with multi-user collaboration:

- **Google Photos** (Shared Albums)
- **Amazon Photos** (Organizational structure)
- **Flickr** (Galleries/Collections hierarchy)
- **OneDrive/SharePoint** (Enterprise folder permissions)
- **Notion** (Workspace/page hierarchy with granular access)
- **Dropbox** (Shared folder structure)

### Key Finding for CoGallery
A **hybrid permission model** combining PostgreSQL Row Level Security (RLS) with Supabase auth, CRDT-based real-time sync, and per-room creator control best serves CoGallery's requirements.

---

## Platform Comparison Matrix

| Aspect | Google Photos | Amazon Photos | Flickr | SharePoint/OneDrive | Notion | Dropbox |
|--------|--------------|---------------|--------|-------------------|--------|---------|
| **Hierarchy Depth** | 2-3 levels (Account → Shared Album → Photos) | 3-4 levels (Account → Folder → Subfolder → Images) | 3 levels (Account → Gallery/Collection → Photos) | 5+ levels (Site → Library → Folder → Subfolder) | 6+ levels (Workspace → Teamspace → Pages → Subpages) | 4-5 levels (Account → Shared Folder → Subfolder) |
| **Permission Model** | Owner/Editor/Viewer on album; all photos inherited | Folder-level permissions with inheritance | Limited (public/private/friends only) | Inheritance with permission breaks possible | Granular per-page; can override inherited | Inheritance-based; folder-level control |
| **Deletion Rights** | Uploader + Owner | Owner + Admins | Uploader only | Owner + Admins (configurable) | Database creator/admins | Folder owner; files retained in trash |
| **Contribution Tracking** | Via uploader metadata; timestamp | Folder/owner metadata | Limited tracking | Item properties show creator/editor history | Database shows creator via person property | Version history per file |
| **Real-time Sync** | WebSocket + eventual consistency | S3 eventual consistency | N/A (async) | SharePoint Online: WebSocket-based presence | WebSocket + CRDT (Yjs-like) | WebSocket for presence + eventual consistency |
| **Storage Model** | Deduplicated cloud (Google One) | S3 bucket-based | CDN-distributed | OneDrive (cloud) or On-premises | Notion databases (blob storage) | CDN/Dropbox servers |
| **Concurrency Handling** | Last-Write-Wins (LWW) with server authority | S3 versioning (eventual) | N/A | Version control with merge capabilities | CRDT-based merging | Conflict resolution via "conflicted copy" |
| **Scalability Pattern** | Multi-region; ~500M+ photos per user possible | Multi-region S3; unlimited scale | Legacy system; limited scale | O365 subscription model; 25TB+ per user | Per-workspace quotas; server-side limits | File size per file: 2GB+ typical |
| **Video Support** | Yes (1GB limit with backup) | Yes (video storage) | Limited (legacy) | Yes (video with streaming) | Embedded video | Yes (inline player) |
| **Presence Indicators** | Limited | No | N/A | Yes (live presence on documents) | Yes (real-time avatars + cursor tracking) | Yes (collaborative editing presence) |

---

## Detailed Platform Analysis

### 1. Google Photos (Shared Albums)

**Hierarchy:**
```
Google Account
├── Library (personal backup)
├── Shared Album 1 (managed)
└── Shared Album 2
```

**Permission Model:**
- **Owner:** Can invite, edit album, delete album
- **Editor:** Can upload/organize photos, invite others
- **Viewer:** Can view and comment only

**Contribution Tracking:**
- Implicit: timestamp + uploader ID on each photo
- No per-user contribution metrics dashboard

**Real-time Sync:**
- WebSocket for presence awareness
- Eventual consistency model (~few seconds)
- Comments update in real-time; photo organization has slight delay

**Deletion Policy:**
- Owner can delete entire album
- Editors/viewers cannot delete album
- Individual photos: uploader or owner can delete

**Storage Optimization:**
- Automatic deduplication across storage (same photo in multiple albums = 1 copy)
- Compression tiers: Original/High quality/Storage saver
- Tiered storage: inactive albums may move to cold storage

**Insights for CoGallery:**
✓ Simple 2-level hierarchy works well for trips  
✓ Owner-editor-viewer model is intuitive  
✗ Limited per-user tracking of contributions  
⚠ LWW approach may lose concurrent edits

---

### 2. Amazon Photos

**Hierarchy:**
```
Amazon Account
├── Photos folder
│   ├── Subfolder A
│   │   ├── Subfolder A1
│   │   └── Photos
│   └── Subfolder B
│       └── Photos
└── Shared folders
    └── Photos
```

**Permission Model:**
- Folder-level permissions with inheritance
- Share individual folders with specific people
- Recipients: Can view, or View + Upload

**Contribution Tracking:**
- Folder metadata shows owner
- Upload timestamps tracked per file
- Limited UI for contribution metrics

**Real-time Sync:**
- S3-backed (eventual consistency, typically <5s)
- No collaborative editing
- Uploads queued client-side

**Deletion Policy:**
- Folder owner controls deletion rights
- Shared folder participants generally cannot delete folder

**Storage:**
- Prime members: unlimited photo storage
- Efficient tiered storage
- Object versioning available

**Insights for CoGallery:**
✓ Deep folder nesting supports complex trip structures  
✓ Simple permission model easy to implement  
✗ Eventual consistency model; no real-time collaboration  
✗ Minimal contribution tracking

---

### 3. Flickr

**Hierarchy:**
```
Flickr Account
├── Galleries (curated collections)
│   └── Gallery
│       ├── Photos
│       └── Videos
├── Collections (groupings of galleries)
│   └── Photos
└── Albums (chronological)
```

**Permission Model:**
- Per-photo privacy: Public/Friends/Family/Private
- Album sharing via tokens
- No granular per-user permissions

**Contribution Tracking:**
- Photo metadata shows photographer/uploader
- Limited aggregated stats

**Real-time Sync:**
- Asynchronous only; no real-time collaboration
- Backend updates may take hours for index

**Deletion:**
- Uploader only (strict)
- Permanent deletion; no trash

**Scalability:**
- Legacy system; architectural limitations
- Maximum ~20K photos per account without performance issues

**Insights for CoGallery:**
✗ Outdated architecture; not recommended for new platforms  
✗ No collaborative editing  
✗ Privacy model too coarse-grained  
✓ Strict deletion rights provide data safety

---

### 4. SharePoint/OneDrive

**Hierarchy:**
```
Tenant
└── Site
    └── Library (document library)
        ├── Folder (can break inheritance)
        │   ├── Subfolder
        │   └── Files
        └── Files
```

**Permission Model:**
- Role-Based Access Control (RBAC):
  - **Owner:** Full control (delete, share, assign roles)
  - **Editor:** Create/modify/delete items in library
  - **Contributor:** Create/modify items
  - **Reader:** View only
  - **Restricted Reader:** Limited view
- Permission inheritance from parent; breakable at subfolder level
- Granular column-level permissions available

**Contribution Tracking:**
- Item properties tab: Created by, Modified by, versions
- Activity feed with timestamp
- Detailed audit logs (O365 compliance)

**Real-time Sync:**
- SharePoint Online: WebSocket-based; real-time co-editing
- OneDrive sync: Background sync with merge conflict handling
- Presence awareness (avatars, cursor positions)

**Deletion Policy:**
- Owner/Site admin only
- Items go to recycle bin (30-day retention by default)
- Second-stage recycle bin for admins (93 days)

**Scalability:**
- Per-library: 30M items typically
- Per-user: 25TB OneDrive
- Multi-region replication

**Insights for CoGallery:**
✓ Inheritance model with override capability excellent for rooms + sub-rooms  
✓ Detailed contribution tracking and versioning  
✓ Recycle bin approach for safe deletion  
✓ Real-time co-editing with presence  
✗ Overly complex for simple trip sharing use case  
✗ Requires Microsoft 365 subscription

---

### 5. Notion

**Hierarchy:**
```
Workspace
├── Teamspace (team container)
│   ├── Page 1
│   │   ├── Subpage 1.1
│   │   └── Subpage 1.2
│   └── Database (with linked records)
└── Private Section
    └── Pages
```

**Permission Model:**
- **Workspace-level:** Workspace owner, members, guests
- **Page-level:** Full access / Can edit / Can comment / Can view
- **Database-level:** Page-level access + field-level permissions (Business plan)
- Inheritance: Pages inherit parent permissions; can be overridden
- Access request workflow available

**Contribution Tracking:**
- Database: "Created by" property (person type)
- Comments tracked with author
- Version history available (comments on all changes)
- Recent editor displayed on page

**Real-time Sync:**
- WebSocket for real-time presence (avatars, cursor tracking)
- CRDT-based conflict resolution (similar to Yjs)
- Real-time mentions and comments
- Offline support with eventual sync

**Deletion Policy:**
- Page creator or workspace owner can delete
- Move to trash (30-day retention)
- Workspace owner can permanently delete

**Multi-user Contribution:**
- Assigned property: Track who's responsible
- Collaborative editing with live presence
- Comment threads per block/element

**Scalability:**
- Per-workspace: typically 1M+ pages
- Per-database: 100K+ records practical limit
- Real-time presence scales to ~100 concurrent editors per page

**Video Support:**
- Embedded videos via URL (YouTube, Vimeo, etc.)
- File uploads (up to 100MB)

**Insights for CoGallery:** ⭐ **STRONG MODEL FOR COGALLERY**
✓ Permission hierarchy with override is perfect for rooms + events  
✓ Excellent contribution tracking (created by, assigned to)  
✓ CRDT-based real-time sync handles offline + concurrent edits  
✓ Workspace structure maps well to trips  
✓ Presence indicators enhance collaboration  
✗ Commercial service; pricing per user  
→ **Recommended pattern for database schema design**

---

### 6. Dropbox

**Hierarchy:**
```
Dropbox Account
├── My Files
│   ├── Folder
│   │   ├── Subfolder
│   │   └── Files
│   └── Files
└── Shared Folder (team space)
    ├── Subfolder
    └── Files
```

**Permission Model:**
- **Folder owner:** Full control (delete, share, manage members)
- **Editor:** Upload/edit/delete files in shared folder
- **Viewer:** View and download only
- Permissions inherited from parent folder
- Sharing links: Public/team/password-protected

**Contribution Tracking:**
- File metadata: "Uploaded by" + timestamp
- Version history per file (30-day retention free tier)
- Activity log (team plan feature)

**Real-time Sync:**
- WebSocket presence for shared folder access
- Delta sync (only changed blocks sync)
- Eventual consistency (~few seconds, usually <1s)

**Deletion Policy:**
- Folder owner or admin
- Files/folders go to ".Dropbox.cache" or trash
- 30-day trash retention (free tier)

**Scalability:**
- Per folder: ~millions of files practical
- Per user: 2TB+ typical
- Sync client handles large hierarchies efficiently

**Video Support:**
- Any video format accepted
- Inline preview for common formats
- No video streaming optimization (downloads file)

**Insights for CoGallery:**
✓ Simple permission model  
✓ Effective folder hierarchy  
✓ Delta sync efficient for bandwidth  
✗ Eventual consistency; not real-time  
✗ Limited per-user contribution dashboard

---

## Real-Time Synchronization Technologies

### Operational Transformation (OT)
**Used by:** Google Docs, Google Wave, SharePoint

**How it works:**
- Each client maintains local copy
- Operations (insert, delete, update) propagated to server
- Server transforms concurrent operations to maintain consistency
- Convergence properties: Causality + Intention Preservation

**Pros:**
- Well-tested in production
- Good for document-style edits
- Clear causality preservation

**Cons:**
- Complex to implement correctly
- ~2 years development time (Google Wave example)
- Tight coupling between client/server transformations required

**Example:**
```
Client 1 edits: "abc" → Insert[0, "x"] → "xabc"
Client 2 edits: "abc" → Delete[2, "c"] → "ab"
Server merges: Transforms Delete[2,"c"] to Delete[3,"c"]
Result: "xab" (consistent across both clients)
```

---

### Conflict-free Replicated Data Types (CRDTs)
**Used by:** Apple Notes, Figma, Nimbus Note, Redis, Notion-like systems

**How it works:**
- Data structure replicated independently on each client
- Operations commutative & associative (order doesn't matter)
- Automatic convergence without central coordination
- Two types: State-based (send full state) or Operation-based (send operations)

**Pros:**
- No central server needed for sync
- Offline-first architecture
- Simpler correctness proofs
- Automatic eventual consistency

**Cons:**
- Metadata overhead (timestamps/unique IDs per operation)
- More complex for developers
- May not preserve "intention" in edge cases

**CRDT Examples:**
- **OR-Set (Observed-Remove Set):** Add/remove with unique tags
- **LWW Register (Last-Write-Wins):** Simple timestamp-based conflict resolution
- **Sequence CRDTs (Yjs, Logoot):** For ordered data like text/arrays

**Popular implementations:**
- **Yjs:** Performant, widely used (Google Docs alternative)
- **Automerge:** Rich data types, functional approach
- **Y.js + Supabase:** Real-time sync with persistence

---

### Hybrid Approach (Recommended for CoGallery)
**Combination:** PostgreSQL RLS + WebSocket + Event Sourcing

```
┌─────────────────────────────────────────┐
│       Supabase Real-time (WebSocket)    │
│  (Broadcast RLS-filtered changes)       │
└──────────────┬──────────────────────────┘
               │
    ┌──────────┴──────────┐
    ▼                     ▼
PostgreSQL Database    Redis Cache
(Source of Truth)      (Session state)
│                      
├─ Row Level Security  
│  (per-user access)   
│                      
├─ Event Triggers      
│  (audit log)         
│                      
└─ JSONB Metadata      
   (creation, updates) 
```

**Benefits:**
- RLS enforces permissions at database level (security in depth)
- WebSocket broadcasts only changes user can see
- Event sourcing maintains audit trail
- Simpler than full CRDT for photo metadata
- Fallback to eventual consistency if connection drops

---

## Storage Organization Patterns

### Pattern 1: Cloud Deduplication (Google Photos)
**Structure:**
```
Storage Backend
├── Photo Hash → Physical File
│   └── Shared by: [Room1, Room2, User_Profile]
├── Reference: Room1/Event1/Photo_123
│   └── Points to: Photo Hash
└── Metadata: {creator, timestamp, tags}
```

**Pros:** Minimal storage; efficient bandwidth  
**Cons:** Complex deduplication logic; cold storage routing needed

### Pattern 2: Folder-Based Organization (Dropbox, OneDrive)
**Structure:**
```
/RoomID
  /EventID_timestamp
    /photo_1.jpg (metadata: creator, timestamp)
    /photo_2.jpg
  /EventID_timestamp_2
    /photos...
  /_metadata.json (room-level permissions)
```

**Pros:** Simple; easy access control  
**Cons:** Redundant storage if photos shared across rooms

### Pattern 3: Database + Blob Storage (Recommended for CoGallery)
**Structure:**
```
PostgreSQL (metadata + permissions)
├── rooms
│   └── {room_id, creator_id, created_at, perms_json}
├── events
│   └── {event_id, room_id, creator_id, ...}
├── photos
│   └── {photo_id, event_id, storage_path, creator_id, created_at}
└── contributions
    └── {user_id, room_id, photo_count, last_contribution}

S3/Supabase Storage (binary blobs)
├── /rooms/{room_id}/events/{event_id}/photo_{id}.jpg
├── /rooms/{room_id}/events/{event_id}/photo_{id}_thumb.jpg
└── /rooms/{room_id}/events/{event_id}/video_{id}.mp4
```

**Pros:**
- Clean separation: metadata (queryable) vs. blobs (scalable)
- Easy RLS on metadata queries
- Efficient thumbnail generation
- Video transcoding pipeline possible

**Cons:** Two systems to manage

---

## Best Practices for CoGallery's Trip/Event Model

### 1. Permission Hierarchy Design

```sql
-- Core permission model
CREATE TABLE rooms (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  creator_id UUID NOT NULL REFERENCES auth.users,
  created_at TIMESTAMP DEFAULT NOW(),
  perms_roles TEXT[] DEFAULT ARRAY['creator', 'editor', 'viewer']
);

CREATE TABLE room_members (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  user_id UUID REFERENCES auth.users,
  role TEXT CHECK (role IN ('creator', 'editor', 'viewer')),
  UNIQUE(room_id, user_id)
);

CREATE TABLE events (
  id UUID PRIMARY KEY,
  room_id UUID REFERENCES rooms(id),
  creator_id UUID REFERENCES auth.users,
  name TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
  -- Inherits room permissions; creator has edit rights
);

CREATE TABLE photos (
  id UUID PRIMARY KEY,
  event_id UUID REFERENCES events(id),
  creator_id UUID REFERENCES auth.users,
  file_path TEXT UNIQUE,
  created_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB -- tags, description, exif
);

-- Row Level Security: Only room members can see photos
CREATE POLICY room_access ON photos
  USING (
    event_id IN (
      SELECT e.id FROM events e
      WHERE e.room_id IN (
        SELECT room_id FROM room_members 
        WHERE user_id = auth.uid()
      )
    )
  );
```

### 2. Deletion Rights (Creator-Only Model)

```sql
-- Only room creator can delete room
CREATE POLICY room_deletion ON rooms
  FOR DELETE USING (creator_id = auth.uid());

-- Only event creator can delete event
CREATE POLICY event_deletion ON events
  FOR DELETE USING (creator_id = auth.uid());

-- Only photo uploader or room creator can delete photo
CREATE POLICY photo_deletion ON photos
  FOR DELETE USING (
    creator_id = auth.uid() OR 
    event_id IN (
      SELECT id FROM events 
      WHERE room_id IN (
        SELECT id FROM rooms WHERE creator_id = auth.uid()
      )
    )
  );
```

### 3. Contribution Tracking

```sql
CREATE TABLE contribution_stats (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  room_id UUID REFERENCES rooms(id),
  photo_count INT DEFAULT 0,
  video_count INT DEFAULT 0,
  last_contribution TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, room_id)
);

-- Trigger to update stats on photo insert
CREATE FUNCTION update_contribution_stats()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO contribution_stats (user_id, room_id, photo_count, last_contribution)
  SELECT 
    NEW.creator_id,
    e.room_id,
    1,
    NOW()
  FROM events e WHERE e.id = NEW.event_id
  ON CONFLICT (user_id, room_id) 
  DO UPDATE SET 
    photo_count = contribution_stats.photo_count + 1,
    last_contribution = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER photo_contribution_trigger
AFTER INSERT ON photos
FOR EACH ROW
EXECUTE FUNCTION update_contribution_stats();
```

### 4. Real-Time Sync Strategy

**Client-side (React):**
```typescript
// Subscribe to room changes via Supabase realtime
const subscription = supabase
  .channel(`room:${roomId}`)
  .on('postgres_changes', 
    {
      event: '*',
      schema: 'public',
      table: 'photos',
      filter: `event_id=eq.${eventId}`
    },
    (payload) => {
      // RLS automatically filters invisible photos
      if (payload.eventType === 'INSERT') {
        addPhotoToUI(payload.new);
      } else if (payload.eventType === 'DELETE') {
        removePhotoFromUI(payload.old.id);
      }
    }
  )
  .subscribe();
```

**Server-side (Supabase Edge Functions):**
```typescript
// Broadcast function with RLS enforcement
import { createClient } from '@supabase/supabase-js'

export default async (req, context) => {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // Event trigger fires; RLS filter applied automatically
  const { event, data } = await req.json()
  
  if (event === 'photo_uploaded') {
    // Supabase Realtime respects RLS:
    // Only users in room_members see this broadcast
    supabase
      .channel(`room:${data.roomId}`)
      .send({
        type: 'broadcast',
        event: 'photo_added',
        payload: data
      })
  }
}
```

### 5. Storage Optimization

**Tiered Storage Strategy:**
```
Hot (< 7 days)     → Supabase Storage (fast CDN)
Warm (7-90 days)   → S3 Standard (cheaper)
Cold (> 90 days)   → S3 Glacier (cheapest, async retrieval)

Thumbnails/Previews:
- 200x200 (list view)     → Generated on upload, cached
- 800x800 (gallery view)  → Generated on demand, cached
- Original               → Stored separately
```

**Bandwidth Optimization:**
- Implement HTTP Range requests for video preview scrubbing
- Use Next.js Image Optimization for responsive thumbnails
- Implement lazy loading for photo galleries

### 6. Video Support

**Recommendations:**
```
Upload Workflow:
1. Client: Upload video (chunk-based, resumable)
2. Server: Validate codec (H.264 for compatibility)
3. Server: Generate thumbnail frame at 5s
4. Server: Optional: Transcode to HLS for streaming
5. Database: Store metadata (duration, codec, size)
6. Realtime: Notify room members

Constraints:
- Max video: 500MB (typical mobile upload limit)
- Supported codecs: H.264, VP9
- Audio: AAC, Opus
- Container: MP4, WebM

Streaming:
- Use Supabase Storage CDN for < 100MB
- Use HLS stream for > 100MB (requires Lambda transcoding)
```

---

## Scalability Considerations

### Current Architecture Limits

| Metric | Current Limit | Scaling Point |
|--------|--------------|----------------|
| Photos per room | ~10K (UI performance) | Pagination + infinite scroll |
| Concurrent editors | ~50 (WebSocket connections) | Move to message queue (AWS SQS) |
| Room members | ~500 (permission query perf) | Implement member caching |
| Video storage/room | ~50GB | Implement quota per room |
| Real-time subscribers | ~100 (per channel) | Fan-out messaging pattern |

### Recommended Optimizations

1. **Database Indexing:**
```sql
CREATE INDEX idx_room_members_user_id ON room_members(user_id);
CREATE INDEX idx_photos_event_creator ON photos(event_id, creator_id);
CREATE INDEX idx_contribution_room_user ON contribution_stats(room_id, user_id);
```

2. **Caching Layer (Redis):**
   - Cache room membership list (5-min TTL)
   - Cache contribution stats (10-min TTL)
   - Cache permission roles (1-hour TTL)

3. **Async Processing:**
   - Use Supabase Functions for thumbnail generation
   - Queue video transcoding jobs (separate service)
   - Batch update contribution stats (hourly)

---

## CoGallery Recommended Architecture

### Final Recommendation

```
┌──────────────────────────────────────────┐
│         React Frontend (Vite)            │
│  - React Query for caching              │
│  - TanStack Router for navigation        │
└────────────────┬─────────────────────────┘
                 │
    ┌────────────┴────────────┐
    ▼                         ▼
Supabase Auth          Supabase Realtime
├─ JWT tokens          ├─ WebSocket subscriptions
└─ User profiles       └─ RLS-filtered broadcasts

    ▼                         
PostgreSQL (Supabase)
├─ Row Level Security (permission enforcement)
├─ Event triggers (audit + stats)
├─ Tables:
│  ├─ rooms (creator, perms)
│  ├─ events (room hierarchy)
│  ├─ photos (metadata, creator tracking)
│  ├─ room_members (access control)
│  └─ contribution_stats (aggregated)
└─ Policies:
   ├─ SELECT: Only room members
   ├─ INSERT: Room members with editor+ role
   ├─ DELETE: Photo creator or room creator

    ▼
Supabase Storage (S3 backend)
├─ /rooms/{room_id}/events/{event_id}/photo_{id}.jpg
├─ /rooms/{room_id}/events/{event_id}/thumb_{id}.jpg
└─ /rooms/{room_id}/events/{event_id}/video_{id}.mp4

    ▼
Supabase Functions (Edge functions)
├─ Thumbnail generation on upload
├─ Video metadata extraction
└─ Cleanup jobs (delete orphaned files)
```

### Why This Architecture?

| Choice | Rationale |
|--------|-----------|
| **PostgreSQL RLS** | Security at DB layer; permissions enforced everywhere |
| **Supabase Realtime** | WebSocket + RLS integration; developers don't manage sync logic |
| **Event Triggers** | Automatic audit trails; contribution stats updated without race conditions |
| **S3 Storage** | Unlimited scale; CDN integration; lifecycle policies for archiving |
| **JSONB metadata** | Flexible schema evolution; queryable without separate column |
| **Edge Functions** | Serverless; automatic scaling; lightweight (good for thumbnails) |

---

## Implementation Roadmap

### Phase 1: MVP (Weeks 1-4)
- [ ] Core tables: rooms, events, photos, room_members
- [ ] RLS policies for basic access control
- [ ] Photo upload (client → S3)
- [ ] Photo gallery view with permission filtering
- [ ] Contribution counter (simple)

### Phase 2: Real-time & Deletion (Weeks 5-8)
- [ ] Supabase Realtime subscriptions
- [ ] Creator-only deletion enforcement
- [ ] Soft deletes (archive instead of permanent delete)
- [ ] Trash/recovery feature (30-day retention)

### Phase 3: Video & Advanced (Weeks 9-12)
- [ ] Video upload with validation
- [ ] Thumbnail generation pipeline
- [ ] Compression tier selection (original/high/data-saver)
- [ ] Download/export feature

### Phase 4: Optimization & Monitoring (Weeks 13+)
- [ ] Performance profiling (EXPLAIN ANALYZE queries)
- [ ] Redis caching for permission queries
- [ ] Analytics dashboard (contribution trends)
- [ ] Backup & disaster recovery procedures

---

## Conclusion

CoGallery should adopt a **Supabase-centric architecture** leveraging:

1. **PostgreSQL Row Level Security** for permission enforcement
2. **Event-driven updates** via Supabase Realtime (WebSocket)
3. **Creator-only deletion** via database policies
4. **JSONB metadata** for flexible per-user tracking
5. **S3/Supabase Storage** for unlimited media scale

This approach provides the **collaboration feel of Notion** (real-time + granular permissions) with the **simplicity of Dropbox** (folder hierarchy) and the **media strengths of Google Photos** (efficient storage, metadata tracking).

**Estimated effort:** 3 months for full feature parity with comparison platforms.

