-- ============================================================================
-- COGALLERY: SOCIAL ENGAGEMENT (REACTIONS & COMMENTS)
-- ============================================================================

-- 1. Create reactions table
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(photo_id, user_id, emoji)
);

-- 2. Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Enable RLS
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;

-- 4. Policies for reactions

-- View reactions: Any authenticated user can view
DROP POLICY IF EXISTS "Authenticated users can view reactions" ON reactions;
CREATE POLICY "Authenticated users can view reactions"
ON reactions FOR SELECT
TO authenticated
USING (true);

-- Insert reactions: User can add reaction
DROP POLICY IF EXISTS "Users can insert their own reactions" ON reactions;
CREATE POLICY "Users can insert their own reactions"
ON reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Delete reactions: User can remove their reaction
DROP POLICY IF EXISTS "Users can delete their own reactions" ON reactions;
CREATE POLICY "Users can delete their own reactions"
ON reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);


-- 5. Policies for comments

-- View comments: Any authenticated user can view
DROP POLICY IF EXISTS "Authenticated users can view comments" ON comments;
CREATE POLICY "Authenticated users can view comments"
ON comments FOR SELECT
TO authenticated
USING (true);

-- Insert comments: User can comment
DROP POLICY IF EXISTS "Users can insert their own comments" ON comments;
CREATE POLICY "Users can insert their own comments"
ON comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Update comments: User can update their own comment
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
CREATE POLICY "Users can update their own comments"
ON comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Delete comments: User can delete their own comment
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;
CREATE POLICY "Users can delete their own comments"
ON comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
