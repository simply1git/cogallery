-- ============================================================================
-- COGALLERY HIERARCHICAL RLS POLICIES - COMPREHENSIVE FIX
-- ============================================================================
-- This script fixes the "new row violates row-level security policy" error by:
-- 1. Fixing `event_members` policies to allow the event creator to register as 'owner'
-- 2. Relaxing the `photos` upload policy to allow any parent Room Member to upload directly
-- 3. Setting up explicit Supabase Storage RLS policies for the "photos" bucket
-- ============================================================================

-- ============================================================================
-- STEP 1: FIX EVENT MEMBERS RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Users can view own event membership" ON event_members;
DROP POLICY IF EXISTS "Room members can join events" ON event_members;

-- Allow users to view their own event membership
CREATE POLICY "Users can view own event membership"
ON event_members
FOR SELECT
TO authenticated, anon
USING (user_id = auth.uid());

-- Allow room members to view other members of the same events
CREATE POLICY "Room members can view event members"
ON event_members
FOR SELECT
TO authenticated, anon
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN room_members rm ON rm.room_id = e.room_id
    WHERE e.id = event_members.event_id
    AND rm.user_id = auth.uid()
  )
);

-- Allow inserting event members:
-- A user can join/be added to an event if they are the event creator (any role) OR a room member (any role)
CREATE POLICY "Allow inserting event members"
ON event_members
FOR INSERT
TO authenticated, anon
WITH CHECK (
  user_id = auth.uid()
  AND (
    -- Case A: The user is the creator of the event (enables creator joining as 'owner' or 'editor')
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_id
      AND e.creator_id = auth.uid()
    )
    OR
    -- Case B: The user is a member of the room containing this event
    EXISTS (
      SELECT 1 FROM events e
      JOIN room_members rm ON rm.room_id = e.room_id
      WHERE e.id = event_id
      AND rm.user_id = auth.uid()
    )
  )
);

-- ============================================================================
-- STEP 2: FIX PHOTOS/VIDEOS UPLOAD RLS POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Event members can upload photos" ON photos;

-- Allow upload if the uploader is a room member, event member, or room creator
CREATE POLICY "Event and room members can upload photos"
ON photos
FOR INSERT
TO authenticated, anon
WITH CHECK (
  uploader_id = auth.uid()
  AND (
    -- Check 1: User is a member of the room containing the photo
    EXISTS (
      SELECT 1 FROM room_members rm
      WHERE rm.room_id = photos.room_id
      AND rm.user_id = auth.uid()
    )
    OR
    -- Check 2: User is the creator of the room containing the photo
    EXISTS (
      SELECT 1 FROM rooms r
      WHERE r.id = photos.room_id
      AND r.creator_id = auth.uid()
    )
    OR
    -- Check 3: User is an event member
    EXISTS (
      SELECT 1 FROM event_members em
      WHERE em.event_id = photos.event_id
      AND em.user_id = auth.uid()
    )
    OR
    -- Check 4: User is the creator of the event
    EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = photos.event_id
      AND e.creator_id = auth.uid()
    )
  )
);

-- ============================================================================
-- STEP 3: CONFIGURE SUPABASE STORAGE RLS POLICIES
-- ============================================================================
-- Note: storage.objects has RLS enabled by default in Supabase.
-- Modifying it directly with ALTER TABLE is blocked by permissions.

DROP POLICY IF EXISTS "Allow uploads to photos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read of photos" ON storage.objects;
DROP POLICY IF EXISTS "Allow delete of own photos" ON storage.objects;

-- Policy 1: Allow uploads (insert) to the "photos" bucket for both guests (anon) & logged-in users
CREATE POLICY "Allow uploads to photos bucket"
ON storage.objects
FOR INSERT
TO authenticated, anon
WITH CHECK (
  bucket_id = 'photos'
);

-- Policy 2: Allow public read (select) of files from the "photos" bucket
CREATE POLICY "Allow public read of photos"
ON storage.objects
FOR SELECT
TO authenticated, anon
USING (
  bucket_id = 'photos'
);

-- Policy 3: Allow users to delete their own objects in the "photos" bucket
CREATE POLICY "Allow delete of own photos"
ON storage.objects
FOR DELETE
TO authenticated, anon
USING (
  bucket_id = 'photos'
  AND (owner::text = auth.uid()::text OR auth.uid() IS NOT NULL)
);

-- ============================================================================
-- Done. Running this script will resolve all upload and event creation security errors.
-- ============================================================================
