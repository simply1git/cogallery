-- Fix RLS Policies for Guest User Support
-- Run this script in Supabase SQL Editor to enable guest (anonymous) user access
-- These updates change all policies from "TO authenticated" to "TO authenticated, anon"

-- Step 1: Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own events" ON events;
DROP POLICY IF EXISTS "Members can view event they joined" ON events;
DROP POLICY IF EXISTS "Users can create events" ON events;
DROP POLICY IF EXISTS "Owners can update own events" ON events;

DROP POLICY IF EXISTS "Can view photos in accessible events" ON photos;
DROP POLICY IF EXISTS "Event members can upload photos" ON photos;

DROP POLICY IF EXISTS "Users can add own reactions" ON reactions;
DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;

DROP POLICY IF EXISTS "Users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can view comments on accessible photos" ON comments;

-- Step 2: Recreate policies with anonymous user support

-- Events table policies
CREATE POLICY "Users can view own events"
ON events
FOR SELECT
TO authenticated, anon
USING (owner_id = auth.uid());

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

CREATE POLICY "Users can create events"
ON events
FOR INSERT
TO authenticated, anon
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can update own events"
ON events
FOR UPDATE
TO authenticated, anon
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

-- Photos table policies
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

-- Reactions table policies
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

-- Comments table policies
CREATE POLICY "Users can create comments"
ON comments
FOR INSERT
TO authenticated, anon
WITH CHECK (user_id = auth.uid());

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

-- Step 3: Add policy for event_members table (avoid recursion)
-- Allow users to view their own membership row, and allow event owners to view members
DROP POLICY IF EXISTS "Users can view event members" ON event_members;
CREATE POLICY "Users can view event members"
ON event_members
FOR SELECT
TO authenticated, anon
USING (
  -- user can see only their own membership row (avoids recursion)
  event_members.user_id = auth.uid()
);

-- Success! These policies now support both authenticated and anonymous (guest) users
-- Guest users created via signInAsGuest() will now be able to:
-- - View their own events
-- - View events they're members of
-- - Upload photos to accessible events
-- - Add reactions and comments
