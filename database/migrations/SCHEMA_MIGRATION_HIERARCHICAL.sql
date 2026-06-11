-- ============================================================================
-- COGALLERY HIERARCHICAL SCHEMA MIGRATION
-- From: Flat events → To: Rooms > Events > Photos
-- ============================================================================
-- This migration transforms CoGallery into a hierarchical platform:
-- Users create Rooms (trips/vacations)
-- Rooms contain Events (days/occasions)
-- Events contain Photos/Videos uploaded by multiple users
-- Room creator has permanent deletion rights; others are read-only

-- ============================================================================
-- STEP 1: Enable required extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- STEP 2: Drop old flat schema (if migrating from previous version)
-- ============================================================================
DROP TABLE IF EXISTS activity_log CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS reactions CASCADE;
DROP TABLE IF EXISTS photos CASCADE;
DROP TABLE IF EXISTS event_members CASCADE;
DROP TABLE IF EXISTS events CASCADE;

-- ============================================================================
-- STEP 3: Create new hierarchical schema
-- ============================================================================

-- ROOMS: Top-level containers created by users (trips/vacations)
CREATE TABLE rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_archived BOOLEAN DEFAULT FALSE,
  archived_at TIMESTAMP WITH TIME ZONE,
  
  -- Immutable - only creator can delete
  CONSTRAINT room_has_creator CHECK (creator_id IS NOT NULL),
  CONSTRAINT valid_name CHECK (char_length(name) > 0)
);

CREATE INDEX idx_rooms_creator_id ON rooms(creator_id);
CREATE INDEX idx_rooms_created_at ON rooms(created_at DESC);
CREATE INDEX idx_rooms_is_archived ON rooms(is_archived);

-- ROOM_MEMBERS: Who has access to a room and what role
CREATE TABLE room_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' 
    CHECK (role IN ('owner', 'editor', 'viewer')),
  
  invited_by_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_room_members_room_id ON room_members(room_id);
CREATE INDEX idx_room_members_user_id ON room_members(user_id);

-- EVENTS: Sub-containers within rooms (days, occasions, themes)
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  title VARCHAR(255) NOT NULL,
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_title CHECK (char_length(title) > 0)
);

CREATE INDEX idx_events_room_id ON events(room_id);
CREATE INDEX idx_events_creator_id ON events(creator_id);
CREATE INDEX idx_events_created_at ON events(created_at DESC);

-- EVENT_MEMBERS: Who can access specific events within a room
CREATE TABLE event_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  role VARCHAR(20) NOT NULL DEFAULT 'viewer' 
    CHECK (role IN ('owner', 'editor', 'viewer')),
  
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(event_id, user_id)
);

CREATE INDEX idx_event_members_event_id ON event_members(event_id);
CREATE INDEX idx_event_members_user_id ON event_members(user_id);

-- PHOTOS: All photos/videos uploaded to events
CREATE TABLE photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- File information
  filename VARCHAR(255),
  content_hash VARCHAR(64),  -- SHA256 for deduplication
  file_size_bytes BIGINT,
  media_type VARCHAR(50) NOT NULL CHECK (media_type IN ('image', 'video')),
  
  -- Storage references
  s3_key TEXT UNIQUE,
  s3_url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- EXIF metadata (for photos)
  taken_at TIMESTAMP WITH TIME ZONE,
  camera_make VARCHAR(100),
  camera_model VARCHAR(100),
  iso INT,
  aperture DECIMAL(4,1),
  
  -- Location (if EXIF has GPS)
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  description TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_file_size CHECK (file_size_bytes > 0 AND file_size_bytes < 5368709120),  -- < 5GB
  CONSTRAINT valid_url CHECK (char_length(s3_url) > 0)
);

CREATE INDEX idx_photos_event_id ON photos(event_id);
CREATE INDEX idx_photos_room_id ON photos(room_id);
CREATE INDEX idx_photos_uploader_id ON photos(uploader_id);
CREATE INDEX idx_photos_taken_at ON photos(taken_at DESC);
CREATE INDEX idx_photos_created_at ON photos(created_at DESC);

-- REACTIONS: Emoji reactions on photos
CREATE TABLE reactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji VARCHAR(10) NOT NULL,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(photo_id, user_id, emoji)
);

CREATE INDEX idx_reactions_photo_id ON reactions(photo_id);

-- COMMENTS: Text comments on photos
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
CREATE INDEX idx_comments_user_id ON comments(user_id);
CREATE INDEX idx_comments_created_at ON comments(created_at DESC);

-- CONTRIBUTIONS: Track per-user uploads in each room (for leaderboard/stats)
CREATE TABLE user_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  photo_count INT DEFAULT 0,
  video_count INT DEFAULT 0,
  total_size_bytes BIGINT DEFAULT 0,
  
  last_upload_at TIMESTAMP WITH TIME ZONE,
  
  UNIQUE(room_id, user_id)
);

CREATE INDEX idx_contributions_room_id ON user_contributions(room_id);
CREATE INDEX idx_contributions_user_id ON user_contributions(user_id);

-- ACTIVITY_LOG: Audit trail for room actions
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  
  action VARCHAR(50) NOT NULL,  -- 'photo_uploaded', 'user_invited', 'room_archived'
  object_type VARCHAR(50),      -- 'photo', 'room', 'user'
  object_id UUID,
  
  details JSONB,  -- action-specific details
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_activity_log_room_id ON activity_log(room_id);
CREATE INDEX idx_activity_log_user_id ON activity_log(user_id);
CREATE INDEX idx_activity_log_created_at ON activity_log(created_at DESC);

-- ============================================================================
-- STEP 4: Enable Realtime for specific tables
-- ============================================================================
ALTER PUBLICATION supabase_realtime ADD TABLE photos;
ALTER PUBLICATION supabase_realtime ADD TABLE reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE comments;
ALTER PUBLICATION supabase_realtime ADD TABLE room_members;
ALTER PUBLICATION supabase_realtime ADD TABLE event_members;

-- ============================================================================
-- STEP 5: Create SECURITY DEFINER functions (for safe permission checks)
-- ============================================================================

-- Check if user is room creator
CREATE OR REPLACE FUNCTION is_room_creator(room_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM rooms
    WHERE rooms.id = room_id
    AND rooms.creator_id = user_id
  );
$$;

-- Check if user is event creator
CREATE OR REPLACE FUNCTION is_event_creator(event_id UUID, user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events
    WHERE events.id = event_id
    AND events.creator_id = user_id
  );
$$;

-- ============================================================================
-- STEP 6: Enable RLS on all tables
-- ============================================================================
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- Success message
-- ============================================================================
-- Schema migration complete! All tables created with RLS enabled.
-- Ready for policy creation in next step.
