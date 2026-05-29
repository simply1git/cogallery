-- ============================================================================
-- COGALLERY: ADD DELETION AND THUMBNAILS
-- ============================================================================

-- 1. Add Thumbnail Columns
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;

-- 2. Trigger for automatic Event Owners
-- When an event is created, automatically add the event creator and the room creator as owners.
CREATE OR REPLACE FUNCTION add_event_owners_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_room_creator UUID;
BEGIN
  -- Get the creator of the room
  SELECT creator_id INTO v_room_creator FROM rooms WHERE id = NEW.room_id;
  
  -- Add the event creator as an owner
  INSERT INTO event_members (event_id, user_id, role, status)
  VALUES (NEW.id, NEW.creator_id, 'owner', 'approved')
  ON CONFLICT (event_id, user_id) DO NOTHING;

  -- If the event creator is different from the room creator, add the room creator too
  IF NEW.creator_id != v_room_creator THEN
    INSERT INTO event_members (event_id, user_id, role, status)
    VALUES (NEW.id, v_room_creator, 'owner', 'approved')
    ON CONFLICT (event_id, user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_event_created ON events;
CREATE TRIGGER on_event_created
AFTER INSERT ON events
FOR EACH ROW
EXECUTE FUNCTION add_event_owners_trigger();

-- 3. Allow Partial-Access Members to Create Events in the Room
-- We replace the old "Room members can create events" policy with a new one that
-- checks if the user is a room member OR an event member in the room.
DROP POLICY IF EXISTS "Room members can create events" ON events;
DROP POLICY IF EXISTS "Anyone with access can create events" ON events;
CREATE POLICY "Anyone with access can create events"
ON events
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = events.room_id
    AND room_members.user_id = auth.uid()
  ) OR EXISTS (
    SELECT 1 FROM event_members em
    JOIN events e ON e.id = em.event_id
    WHERE e.room_id = events.room_id
    AND em.user_id = auth.uid()
    AND em.status = 'approved'
  )
);

-- 4. Enable actual DELETE for Rooms and Events
-- Room creator can delete the room completely (cascades down to events, members, and photos)
DROP POLICY IF EXISTS "Room creators can delete rooms" ON rooms;
CREATE POLICY "Room creators can delete rooms"
ON rooms
FOR DELETE
TO authenticated
USING (creator_id = auth.uid());

-- Event creators (and room creators) can delete events
-- We already have an "Event creators can archive events" for DELETE, let's replace it with a broader one
DROP POLICY IF EXISTS "Event creators can archive events" ON events;
DROP POLICY IF EXISTS "Event owners can delete events" ON events;
CREATE POLICY "Event owners can delete events"
ON events
FOR DELETE
TO authenticated
USING (
  creator_id = auth.uid() OR
  EXISTS (
    SELECT 1 FROM rooms r WHERE r.id = events.room_id AND r.creator_id = auth.uid()
  )
);
