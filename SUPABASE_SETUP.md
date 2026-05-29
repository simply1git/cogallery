# Supabase Setup Guide for CoGallery

This guide will walk you through setting up Supabase for Phase 1 MVP.

## Prerequisites
- Supabase account (free tier sufficient): https://supabase.com
- 30-45 minutes

## PART 1: Create Supabase Project

### Step 1.1: Create Project
1. Go to https://supabase.com
2. Sign in or create account
3. Click "New project"
4. Fill in:
   - **Name:** cogallery-dev
   - **Database password:** Generate strong password (save this!)
   - **Region:** Choose closest to you (us-east-1 recommended for US)
5. Click "Create new project"
6. Wait 2-3 minutes for setup to complete

### Step 1.2: Get Credentials
1. Go to project dashboard
2. Click "Settings" (gear icon, bottom left)
3. Click "API" in left sidebar
4. Copy these values:
   - **Project URL** (under "API URL")
   - **Anon Key** (under "Project API keys")
5. Save them temporarily

---

## PART 2: Create Database Schema

### Step 2.1: Create Tables via SQL Editor

1. Click "SQL Editor" (left sidebar)
2. Click "New Query"
3. Copy the SQL below and paste it:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables (only on first setup)
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS event_members CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- Events table
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code VARCHAR(6) UNIQUE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  privacy VARCHAR(20) NOT NULL DEFAULT 'shared' CHECK (privacy IN ('private', 'shared', 'public')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE,
  
  -- Archive metadata
  archived_at TIMESTAMP WITH TIME ZONE,
  github_repo_url TEXT,
  github_pages_url TEXT,
  
  CONSTRAINT valid_code CHECK (code ~ '^[A-Z0-9]{6}$')
);

CREATE INDEX idx_events_code ON events(code);
CREATE INDEX idx_events_owner_id ON events(owner_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- Event members (for roles: owner, editor, viewer)
CREATE TABLE event_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' CHECK (role IN ('owner', 'editor', 'viewer')),
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_members_event_id ON event_members(event_id);
CREATE INDEX idx_event_members_user_id ON event_members(user_id);

-- Photos table
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  filename VARCHAR(255),
  content_hash VARCHAR(64),  -- SHA256 for deduplication
  file_size_bytes BIGINT,
  
  -- S3 references
  s3_key TEXT UNIQUE,
  s3_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- EXIF / Metadata
  taken_at TIMESTAMP WITH TIME ZONE,
  camera_make VARCHAR(100),
  camera_model VARCHAR(100),
  lens VARCHAR(100),
  iso INT,
  aperture DECIMAL(4,1),
  shutter_speed VARCHAR(20),
  focal_length DECIMAL(5,1),
  
  -- Location (if EXIF has GPS)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_file_size CHECK (file_size_bytes > 0 AND file_size_bytes < 1073741824)  -- < 1GB
);

CREATE INDEX idx_photos_event_id ON photos(event_id);
CREATE INDEX idx_photos_uploader_id ON photos(uploader_id);
CREATE INDEX idx_photos_content_hash ON photos(content_hash);
CREATE INDEX idx_photos_taken_at ON photos(taken_at DESC);

-- Reactions (emoji reactions on photos)
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(photo_id, user_id, emoji)
);

CREATE INDEX idx_reactions_photo_id ON reactions(photo_id);

-- Comments on photos
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  body TEXT NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT body_not_empty CHECK (char_length(body) > 0)
);

CREATE INDEX idx_comments_photo_id ON comments(photo_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- Activity log for audit trail
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL,  -- 'photo_uploaded', 'user_invited', 'event_archived'
  object_type VARCHAR(50),      -- 'photo', 'event', 'user'
  object_id UUID,
  
  details JSONB,  -- action-specific details
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_event_id ON activity_log(event_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- Enable Realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE event_members;
```

4. Click "Run" button
5. Should see "Success" message

### Step 2.2: Verify Schema Created
1. Click "Table Editor" (left sidebar)
2. Should see these tables listed:
   - events
   - event_members
   - photos
   - reactions
   - comments
   - activity_log
3. Click each to verify columns exist

---

## PART 3: Set Up Row-Level Security (RLS)

RLS ensures users can only access their own events and photos.

### Step 3.1: Enable RLS on All Tables

1. In Table Editor, click "events" table
2. Click "Auth" (right side panel)
3. Toggle "Enable RLS" ON
4. Repeat for:
   - event_members
   - photos
   - reactions
   - comments
   - activity_log

### Step 3.2: Create RLS Policies

Go to "SQL Editor" and run each policy:

**Policy 1: Users can view their own events**
```sql
CREATE POLICY "Users can view own events"
ON events
FOR SELECT
TO authenticated, anon
USING (owner_id = auth.uid());
```

**Policy 2: Users can view events where they're members**
```sql
CREATE POLICY "Members can view event they joined"
ON events
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM event_members
    WHERE event_members.event_id = events.id
    AND event_members.user_id = auth.uid()
  )
  OR owner_id = auth.uid()
);
```

**Policy 3: Anyone can insert if owner_id is themselves**
```sql
CREATE POLICY "Users can create events"
ON events
FOR INSERT
TO authenticated, anon
WITH CHECK (owner_id = auth.uid());
```

**Policy 4: Users can update own events**
```sql
CREATE POLICY "Owners can update own events"
ON events
FOR UPDATE
TO authenticated, anon
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());
```

**Policy 5: Photos - allow viewing if user is event member**
```sql
CREATE POLICY "Can view photos in accessible events"
ON photos
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = photos.event_id
    AND (
      events.owner_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_members
        WHERE event_members.event_id = events.id
        AND event_members.user_id = auth.uid()
      )
    )
  )
);
```

**Policy 6: Photos - allow inserting if event member with upload role**
```sql
CREATE POLICY "Event members can upload photos"
ON photos
FOR INSERT
TO authenticated, anon
WITH CHECK (
  uploader_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM event_members
    WHERE event_members.event_id = photos.event_id
    AND event_members.user_id = auth.uid()
    AND event_members.role IN ('owner', 'editor')
  )
);
```

**Policy 7: Reactions - insert/delete own reactions**
```sql
CREATE POLICY "Users can add own reactions"
ON reactions
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own reactions"
ON reactions
FOR DELETE
TO authenticated, anon
USING (user_id = auth.uid());
```

**Policy 8: Comments - insert own comments**
```sql
CREATE POLICY "Users can create comments"
ON comments
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id = auth.uid());
```

**Policy 9: Comments - view comments on accessible photos**
```sql
CREATE POLICY "Users can view comments on accessible photos"
ON comments
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM photos
    WHERE photos.id = comments.photo_id
    AND EXISTS (
      SELECT 1 FROM events
      WHERE events.id = photos.event_id
      AND (
        events.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM event_members
          WHERE event_members.event_id = events.id
          AND event_members.user_id = auth.uid()
        )
      )
    )
  )
);
```

---

## PART 4: Configure Environment Variables

### Step 4.1: Create `.env.local`

1. In VS Code, open the `client` folder
2. Create file: `.env.local` (if not exists)
3. Add these lines:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Replace:
- `YOUR_PROJECT_ID` with your Supabase project ID (from URL)
- `YOUR_ANON_KEY` with the Anon Key you copied earlier

Example:
```
VITE_SUPABASE_URL=https://abcdefghijklmnop.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Step 4.2: Restart Dev Server

```bash
cd client
npm run dev
```

New environment variables require restart to take effect.

---

## PART 5: Verify Setup Works

1. Go to http://localhost:5173/auth
2. Click "Create New Account"
3. Fill in:
   - Display Name: Test User
   - Email: test@example.com
   - Password: TestPassword123!
4. Click "Create Account"
5. Should see success message
6. Go to Supabase "Authentication" → "Users"
7. Verify your test user is listed

---

## Troubleshooting

### Issue: "Failed to fetch" when signing up
- Check: `.env.local` has correct URL and key
- Check: Restart dev server after updating `.env.local`
- Check: Supabase project is active (dashboard loads)

### Issue: RLS policies failing
- Check: All policies created successfully in SQL Editor
- Check: Tables have RLS enabled (toggle in Auth panel)
- Solution: Restart dev server and try again

### Issue: Tables not showing in Table Editor
- Check: SQL script ran successfully (green "Success" message)
- Solution: Refresh browser

---

## Next Steps

Once setup is complete:
1. Test end-to-end auth (signup/login/guest)
2. Create test event
3. Set up photo upload infrastructure
4. Build photo gallery UI

---

## Quick Reference

**Project URL Pattern:**
```
https://YOUR_PROJECT_ID.supabase.co
```

**Anon Key Location:**
Settings → API → Project API keys (public)

**SQL Editor Location:**
Left sidebar → SQL Editor

**Table Editor Location:**
Left sidebar → Table Editor

**RLS Settings Location:**
Table Editor → Click table → Auth panel (right side)

---

**Status:** Setup Complete ✅
**Time Invested:** ~45 minutes
**What's Enabled:** Database + Auth + RLS + Realtime
**What's Next:** Test auth flows, then build upload system
