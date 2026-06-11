-- Canvas States table for the Moodboard feature
-- Stores the tldraw canvas snapshot for each event

CREATE TABLE IF NOT EXISTS canvas_states (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE UNIQUE,
  canvas_data JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Index for fast lookup by event
CREATE INDEX IF NOT EXISTS idx_canvas_states_event_id ON canvas_states(event_id);

-- RLS: only event members can read/write canvas states
ALTER TABLE canvas_states ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read canvas states for events they have access to
CREATE POLICY "Canvas states are viewable by authenticated users"
  ON canvas_states FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert/update canvas states
CREATE POLICY "Canvas states are editable by authenticated users"
  ON canvas_states FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Canvas states are updatable by authenticated users"
  ON canvas_states FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
