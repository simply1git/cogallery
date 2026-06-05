-- Fix PostgREST 400 error when querying profiles from room_members / event_members
-- PostgREST requires a direct foreign key to traverse relationships.
-- We add a foreign key from user_id to profiles(id) so that `profiles(display_name)` works in the frontend.

DO $$
BEGIN
  -- Add FK for room_members -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_room_members_profile'
  ) THEN
    ALTER TABLE room_members 
    ADD CONSTRAINT fk_room_members_profile 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;

  -- Add FK for event_members -> profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_event_members_profile'
  ) THEN
    ALTER TABLE event_members 
    ADD CONSTRAINT fk_event_members_profile 
    FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;
