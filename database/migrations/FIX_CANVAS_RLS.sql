-- ============================================================================
-- FIX CANVAS_STATES RLS — Event-scoped access only
-- Run in Supabase SQL Editor after CANVAS_STATES_MIGRATION.sql
-- ============================================================================

CREATE OR REPLACE FUNCTION is_event_member(check_event_id UUID, check_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_members em
    WHERE em.event_id = check_event_id
      AND em.user_id = check_user_id
      AND em.status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM events e
    JOIN room_members rm ON rm.room_id = e.room_id
    WHERE e.id = check_event_id
      AND rm.user_id = check_user_id
      AND rm.status = 'approved'
  ) OR EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = check_event_id
      AND e.creator_id = check_user_id
  );
$$;

DROP POLICY IF EXISTS "Canvas states are viewable by authenticated users" ON canvas_states;
DROP POLICY IF EXISTS "Canvas states are editable by authenticated users" ON canvas_states;
DROP POLICY IF EXISTS "Canvas states are updatable by authenticated users" ON canvas_states;

CREATE POLICY "Event members can view canvas states"
  ON canvas_states FOR SELECT
  TO authenticated
  USING (is_event_member(event_id, auth.uid()));

CREATE POLICY "Event members can insert canvas states"
  ON canvas_states FOR INSERT
  TO authenticated
  WITH CHECK (is_event_member(event_id, auth.uid()));

CREATE POLICY "Event members can update canvas states"
  ON canvas_states FOR UPDATE
  TO authenticated
  USING (is_event_member(event_id, auth.uid()))
  WITH CHECK (is_event_member(event_id, auth.uid()));

NOTIFY pgrst, 'reload schema';
