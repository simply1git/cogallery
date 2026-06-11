-- ============================================================================
-- COGALLERY FIX: Event-Level Access + Profiles Table
-- ============================================================================
-- Run this in the Supabase SQL Editor.
--
-- Fixes:
-- 1. Creates a `profiles` table so invite-by-email works.
-- 2. Auto-syncs profiles from auth.users on sign-up.
-- 3. Adds `status` column to event_members/room_members if missing.
-- 4. Adds RLS policy so event-only members can view the event
--    (without needing room membership).
-- ============================================================================

-- ============================================================================
-- STEP 1: Add `status` column to event_members (if missing)
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'event_members'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE event_members ADD COLUMN status VARCHAR(20) DEFAULT 'approved'
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- Add `status` column to room_members (if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'room_members'
    AND column_name = 'status'
  ) THEN
    ALTER TABLE room_members ADD COLUMN status VARCHAR(20) DEFAULT 'approved'
      CHECK (status IN ('pending', 'approved', 'rejected'));
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Create `profiles` table (for invite-by-email lookup)
-- ============================================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Everyone can read profiles (needed for invite-by-email lookup)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
CREATE POLICY "Public profiles are viewable by everyone"
ON profiles
FOR SELECT
TO authenticated, anon
USING (true);

-- Users can update only their own profile
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Users can insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (id = auth.uid());

-- ============================================================================
-- STEP 3: Auto-create profile on user sign-up (trigger)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'displayName', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatarUrl'
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Drop existing trigger if any, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================================
-- STEP 4: Backfill profiles for existing users
-- ============================================================================
INSERT INTO public.profiles (id, email, display_name)
SELECT
  id,
  email,
  COALESCE(raw_user_meta_data->>'displayName', split_part(email, '@', 1))
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- STEP 5: Fix Events RLS - Allow any authenticated user to VIEW events
-- ============================================================================
-- Users with a shared link need to see the event exists so they can request
-- access. The actual sensitive content (photos) remains protected by its own
-- RLS policies. This is how apps like Google Docs work — you see the title
-- and can request access.

-- Drop any old restrictive policies
DROP POLICY IF EXISTS "Event members can view their events" ON events;
DROP POLICY IF EXISTS "Room members can view events" ON events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;

-- Allow any authenticated user to view events (needed for invite link flow)
CREATE POLICY "Authenticated users can view events"
ON events
FOR SELECT
TO authenticated
USING (true);

-- ============================================================================
-- STEP 6: Fix event_members RLS - Allow event owners/admins to manage members
-- ============================================================================
-- Allow event owners or room owners to update event member status (approve/reject)
DROP POLICY IF EXISTS "Event owners can update event members" ON event_members;
CREATE POLICY "Event owners can update event members"
ON event_members
FOR UPDATE
TO authenticated
USING (
  -- Current user is the event creator
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_members.event_id
    AND e.creator_id = auth.uid()
  )
  OR
  -- Current user is a room owner
  EXISTS (
    SELECT 1 FROM events e
    JOIN room_members rm ON rm.room_id = e.room_id
    WHERE e.id = event_members.event_id
    AND rm.user_id = auth.uid()
    AND rm.role = 'owner'
  )
)
WITH CHECK (true);

-- Allow event owners or room owners to delete event members (reject/remove)
DROP POLICY IF EXISTS "Event owners can delete event members" ON event_members;
CREATE POLICY "Event owners can delete event members"
ON event_members
FOR DELETE
TO authenticated
USING (
  -- Current user is the event creator
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = event_members.event_id
    AND e.creator_id = auth.uid()
  )
  OR
  -- Current user is a room owner
  EXISTS (
    SELECT 1 FROM events e
    JOIN room_members rm ON rm.room_id = e.room_id
    WHERE e.id = event_members.event_id
    AND rm.user_id = auth.uid()
    AND rm.role = 'owner'
  )
  OR
  -- User removing themselves
  user_id = auth.uid()
);

-- ============================================================================
-- STEP 7: Allow event-only members to insert their own event_members row
-- (for "Request to Join" flow when they have the link but aren't room members)
-- ============================================================================
DROP POLICY IF EXISTS "Users can request to join events via link" ON event_members;
CREATE POLICY "Users can request to join events via link"
ON event_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
);

-- ============================================================================
-- STEP 8: Allow event owners to view all event members
-- ============================================================================
-- This ensures the event owner can always see pending requests, even if
-- they are somehow not a room member.
-- We use a SECURITY DEFINER function to avoid infinite recursion when querying event_members

DROP FUNCTION IF EXISTS is_event_owner(uuid, uuid) CASCADE;
CREATE OR REPLACE FUNCTION is_event_owner(check_event_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM events e WHERE e.id = check_event_id AND e.creator_id = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM event_members em WHERE em.event_id = check_event_id AND em.user_id = check_user_id AND em.role = 'owner' AND em.status = 'approved'
  );
$$;

DROP POLICY IF EXISTS "Event owners can view all event members" ON event_members;
CREATE POLICY "Event owners can view all event members"
ON event_members
FOR SELECT
TO authenticated
USING (is_event_owner(event_id, auth.uid()));

-- ============================================================================
-- STEP 9: Allow event members to view the room
-- ============================================================================
-- This ensures that users invited only to a specific event can still see
-- the room on their dashboard and load the room details page.
DROP POLICY IF EXISTS "Users can view rooms if they have access to any event" ON rooms;
CREATE POLICY "Users can view rooms if they have access to any event"
ON rooms
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM events e
    JOIN event_members em ON em.event_id = e.id
    WHERE e.room_id = rooms.id
    AND em.user_id = auth.uid()
    AND em.status = 'approved'
  )
);

-- ============================================================================
-- Done!
-- ============================================================================
-- After running this:
-- 1. Invite-by-email will work (profiles table exists)
-- 2. "Request to Join" flow will work on event links
-- 3. Event owners can view and approve pending requests
-- 4. Event members can view their parent room on the dashboard they're part of
-- 3. The invite-by-email feature will work (looks up profiles.email)
-- 4. Users can request to join events via shared links
-- ============================================================================
