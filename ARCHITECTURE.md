# CoGallery - Architecture Deep Dive

## System Architecture Overview

```
USER DEVICES (Web/Mobile)
        ↓
┌─────────────────────────────────────────┐
│         FRONTEND LAYER                  │
│  React 18 + TypeScript + Vite           │
│  Deployed on Vercel                     │
│  CDN: Vercel's global network           │
└─────────────────────────────────────────┘
        ↓              ↓              ↓
    [Auth]       [Real-time]    [Storage]
        ↓              ↓              ↓
┌──────────────┬──────────────┬──────────────┐
│  Supabase    │  Supabase    │   AWS S3     │
│  (Auth)      │  (Realtime)  │  (Photos)    │
└──────────────┴──────────────┴──────────────┘
        ↓              ↓              ↓
┌─────────────────────────────────────────┐
│      DATABASE LAYER                     │
│  PostgreSQL (Supabase Cloud)            │
│  - Metadata storage                     │
│  - User data                            │
│  - Comments & reactions                 │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│      STORAGE LAYER                      │
│  AWS S3 + CloudFront CDN                │
│  - Original photo files                 │
│  - Automatic backups                    │
│  - Global distribution                  │
└─────────────────────────────────────────┘
        ↓
┌─────────────────────────────────────────┐
│      ARCHIVE LAYER                      │
│  GitHub Pages + Actions                 │
│  - Permanent backup                     │
│  - Static galleries                     │
│  - Public/private hosting               │
└─────────────────────────────────────────┘
```

---

## Frontend Architecture

### Component Hierarchy
```
App.tsx
├── Router
│   ├── HomePage
│   ├── EventPage
│   │   ├── EventHeader
│   │   ├── GalleryView
│   │   │   ├── PhotoGrid
│   │   │   │   └── PhotoCard[] (real-time)
│   │   │   └── Pagination
│   │   ├── PhotoUpload
│   │   └── EventActions
│   ├── PhotoDetailView
│   │   ├── PhotoViewer
│   │   ├── CommentSection
│   │   └── ReactionPanel
│   └── SettingsPage
└── AuthLayout
    ├── LoginForm
    ├── SignupForm
    └── GuestEntry
```

### State Management (Zustand)
```typescript
// Store structure
userStore
├── user: CurrentUser
├── isAuthenticated: boolean
└── setUser(), logout()

eventStore
├── currentEvent: Event
├── events: Event[]
├── loading: boolean
└── setEvent(), addEvent()

galleryStore
├── photos: Photo[]
├── selectedPhotos: Set<UUID>
├── currentPage: number
├── total: number
└── addPhoto(), selectPhoto(), paginate()

uploadStore
├── isUploading: boolean
├── uploadProgress: number
├── queuedFiles: File[]
└── upload(), cancel()
```

### Real-Time Subscriptions

**Photo Updates:**
```typescript
// Subscribe to new photos in event
const photos$ = supabase
  .from('photos')
  .on('*', payload => {
    galleryStore.addPhoto(payload.new)
  })
  .subscribe()

// User sees photos instantly as others upload
```

**Comments & Reactions:**
```typescript
// Real-time comment updates
const comments$ = supabase
  .from('comments')
  .on('INSERT', payload => {
    photoDetailStore.addComment(payload.new)
  })
  .subscribe()
```

---

## Backend Architecture

### Supabase PostgreSQL

**Connection Flow:**
```
Frontend (React)
    ↓
Supabase Client Library
    ↓ (JWT Token)
Supabase API Gateway
    ↓
PostgreSQL Database
    ↓
Row Level Security (RLS) Policies
    ↓ (Authorized data only)
Response back to Frontend
```

**RLS Policies Example:**
```sql
-- Users can only see their own events
CREATE POLICY "Users can view own events"
ON events FOR SELECT
USING (auth.uid() = created_by OR is_public = true);

-- Members can view event photos
CREATE POLICY "Event members can view photos"
ON photos FOR SELECT
USING (
  event_id IN (
    SELECT event_id FROM event_members 
    WHERE user_id = auth.uid()
  )
);
```

### Storage Architecture

#### AWS S3 Structure
```
s3://cogallery-photos/
├── events/
│   ├── {event_id}/
│   │   ├── originals/
│   │   │   ├── {photo_id}.heic
│   │   │   ├── {photo_id}.jpg
│   │   │   ├── {photo_id}.png
│   │   │   └── {photo_id}.mp4
│   │   └── thumbnails/
│   │       ├── {photo_id}_thumb.jpg
│   │       └── {photo_id}_thumb_small.jpg
│   └── {event_id}/
└── backups/
    ├── {event_id}_{timestamp}.tar.gz
    └── ...
```

#### Upload Flow
```
User selects photo
    ↓
Frontend calculates hash (SHA-256)
    ↓
Request presigned S3 URL from backend
    ↓ (1-hour expiry)
Browser directly uploads to S3
    ↓
S3 triggers Lambda (optional thumbnail generation)
    ↓
Frontend confirms upload to Supabase
    ↓
Metadata stored in PostgreSQL
    ↓
Real-time event fires
    ↓
All users see new photo instantly
```

#### Download Flow
```
User clicks download
    ↓
Backend generates CloudFront presigned URL
    ↓ (24-hour expiry)
Browser downloads from CloudFront edge location
    ↓
Cached for 1 year at edge
    ↓
Subsequent requests: instant from cache
```

---

## Real-Time Architecture

### Supabase Realtime (WebSocket)

**Technology:**
- PostgreSQL LISTEN/NOTIFY
- WebSocket connections (maintained on Vercel with Server-Sent Events fallback)
- Automatic reconnection with exponential backoff

**Event Flow:**
```
1. Photo inserted into database
   ↓
2. PostgreSQL NOTIFY trigger fires
   ↓
3. Supabase broadcasts to all subscribed clients
   ↓
4. React component receives update
   ↓
5. Gallery re-renders with new photo
   ↓
6. Animation plays
   ↓
Total latency: 200-500ms
```

**Subscription Code Example:**
```typescript
useEffect(() => {
  const subscription = supabase
    .from(`photos:event_id=eq.${eventId}`)
    .on('*', (payload) => {
      console.log('Change received!', payload)
      handlePhotoUpdate(payload)
    })
    .subscribe()
  
  return () => subscription.unsubscribe()
}, [eventId])
```

---

## Authentication Architecture

### User Flow

**Guest Mode (No Auth):**
```
User opens app
    ↓
Click "Join as Guest"
    ↓
Anonymous user created in Supabase
    ↓
JWT token stored in localStorage
    ↓
Can upload photos (until 1hr inactivity)
    ↓
Can't access archived events later
```

**Email Registration:**
```
User clicks "Sign Up"
    ↓
Email + password
    ↓
Supabase creates account
    ↓
Email verification sent (optional)
    ↓
JWT token generated
    ↓
Full access to created events
    ↓
Can access events anytime
```

**OAuth (Future):**
```
Connect GitHub
    ↓
GitHub Authorization Code
    ↓
Exchange for Supabase JWT
    ↓
Create/link user
    ↓
Access GitHub for auto-archive
```

---

## Archive Architecture (GitHub)

### Workflow: Event → GitHub Pages

**Trigger:** User clicks "Archive to GitHub"

```
1. Frontend calls API: POST /api/events/{id}/archive-to-github
   ↓
2. Backend (serverless function):
   - Validates event ownership
   - Generates unique repo name: trip-{eventId}-{date}
   - Creates GitHub repo via API
   - Downloads all photos from S3
   - Generates static HTML gallery
   - Uploads to GitHub repo
   - Enables GitHub Pages
   ↓
3. GitHub Actions workflow:
   - Triggered on upload
   - Runs image optimization (optional)
   - Generates analytics
   - Creates index.html
   ↓
4. Result: https://{username}.github.io/trip-2026-05-bali/
   ↓
5. Link shared with group
   ↓
6. Everyone can access forever ($0 cost)
```

**GitHub Actions Workflow (YAML):**
```yaml
name: Generate Gallery

on:
  push:
    branches: [main]

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install dependencies
        run: npm install
      - name: Generate static gallery
        run: npm run generate-gallery
      - name: Deploy to Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./public
```

---

## Scalability Considerations

### Horizontal Scaling Layers

**Frontend (React):**
- CDN via Vercel (auto-scaling)
- No backend rendering needed
- Can handle 10K+ concurrent users

**Database (PostgreSQL):**
- Supabase auto-scales read replicas
- Connection pooling (PgBouncer)
- Partitioning by event_id for large events
- Estimated capacity: 100K+ events, 100M+ photos

**Storage (S3):**
- Unlimited scalability built-in
- Auto-scaling transfers
- Multi-region replication available
- CDN via CloudFront (caches at edge)

**Real-Time (Supabase Realtime):**
- Horizontal auto-scaling
- Connection pooling
- Can handle 1000s of concurrent subscriptions

### Performance Optimization

**Frontend:**
- Lazy loading thumbnails
- Virtual scrolling for 1000+ photos
- Code splitting with React.lazy()
- Image optimization (JPEG/WebP/AVIF)
- Service worker for offline support

**Database:**
- Compound indexes on (event_id, uploaded_at)
- Materialized views for aggregates
- Query result caching (60 seconds)

**Storage:**
- CloudFront TTL: 1 year for originals
- Gzip compression for metadata
- S3 versioning (for rollback)

---

## Security Model

### Authentication & Authorization

**JWT Token Flow:**
```
POST /auth/login
    ↓
{email, password}
    ↓
Supabase validates
    ↓
Returns: { access_token, refresh_token }
    ↓
Frontend stores in secure httpOnly cookie
    ↓
All requests include JWT in Authorization header
    ↓
Backend validates signature
    ↓
Extracts user ID from payload
    ↓
Enforces RLS policies
```

### Row Level Security (RLS)

**Example Policies:**
```sql
-- Events: Only members can view
CREATE POLICY "View own events"
ON events FOR SELECT
USING (
  auth.uid() IN (
    SELECT user_id FROM event_members
    WHERE event_id = id
  ) OR is_public = true
);

-- Photos: Only event members can view
CREATE POLICY "View event photos"
ON photos FOR SELECT
USING (
  event_id IN (
    SELECT event_id FROM event_members
    WHERE user_id = auth.uid()
  )
);

-- Comments: Can only delete own
CREATE POLICY "Delete own comments"
ON comments FOR DELETE
USING (user_id = auth.uid());
```

### Data Privacy

**Encryption:**
- TLS 1.3 in transit
- AES-256 at rest (Supabase default)
- S3 default encryption enabled
- Database backups encrypted

**Access Control:**
- Private events: invitation-only
- Public events: shareable by link
- Comments: nested under photos (event scope)
- Admin: can delete any photo in event

**Data Retention:**
- Soft delete: photos marked archived
- 30-day recovery period
- After 30 days: permanent deletion

---

## Monitoring & Debugging

### Metrics Tracked
- Real-time subscription latency
- S3 upload/download speed
- Database query performance
- API response times
- Error rates by endpoint

### Logging
- Supabase: Automatic request logging
- Frontend: Sentry for error tracking
- CloudFront: Access logs to S3
- GitHub: Action logs for archive failures

---

## Future Architecture Enhancements

### Phase 2 (6+ months)
- AI-powered auto-tagging
- ML-based duplicate detection
- Advanced facial recognition
- GeoMap gallery view
- Video transcoding pipeline

### Phase 3 (12+ months)
- Mobile app (React Native)
- Offline-first sync
- End-to-end encryption option
- Event streaming (live photo feed)
- AI-generated photo stories

---

**Document Status:** Complete ✅  
**Last Updated:** May 27, 2026
