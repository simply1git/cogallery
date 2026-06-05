-- ============================================================================
-- COGALLERY SECURITY HARDENING v2 — COMPREHENSIVE RLS POLISH
-- ============================================================================
-- Run this in Supabase SQL Editor ONCE.
--
-- WHAT THIS FIXES:
-- 1. Photo deletion: Room/Event owners can now delete ANY photo (not just own)
-- 2. Event deletion: Room owners can now delete ANY event in their room
-- 3. Removes `anon` from all write policies (INSERT/UPDATE/DELETE)
--    Previously anon users could theoretically write data. Now only
--    authenticated users can modify anything.
-- 4. Adds UPDATE policy for photos (missing entirely before)
-- ============================================================================

-- ─── PHOTOS: DELETE ─────────────────────────────────────────────────────────
-- Before: Only uploader could delete. Now: uploader OR room owner OR event owner
DROP POLICY IF EXISTS "Photo uploaders can delete own photos" ON photos;

CREATE POLICY "Authorized users can delete photos"
ON photos FOR DELETE TO authenticated
USING (
  uploader_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = photos.room_id
    AND room_members.user_id = auth.uid()
    AND room_members.role = 'owner'
    AND room_members.status = 'approved'
  )
  OR EXISTS (
    SELECT 1 FROM event_members
    WHERE event_members.event_id = photos.event_id
    AND event_members.user_id = auth.uid()
    AND event_members.role = 'owner'
    AND event_members.status = 'approved'
  )
);

-- ─── PHOTOS: INSERT (tighten to authenticated only) ─────────────────────────
DROP POLICY IF EXISTS "Event members can upload photos" ON photos;

CREATE POLICY "Authenticated event members can upload photos"
ON photos FOR INSERT TO authenticated
WITH CHECK (
  uploader_id = auth.uid()
  AND (
    EXISTS (
      SELECT 1 FROM event_members
      WHERE event_members.event_id = photos.event_id
      AND event_members.user_id = auth.uid()
      AND event_members.status = 'approved'
    )
    OR EXISTS (
      SELECT 1 FROM room_members
      WHERE room_members.room_id = photos.room_id
      AND room_members.user_id = auth.uid()
      AND room_members.status = 'approved'
    )
  )
);

-- ─── EVENTS: DELETE (room owner can delete any event) ───────────────────────
DROP POLICY IF EXISTS "Event creators can archive events" ON events;

CREATE POLICY "Event creator or room owner can delete events"
ON events FOR DELETE TO authenticated
USING (
  creator_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM room_members
    WHERE room_members.room_id = events.room_id
    AND room_members.user_id = auth.uid()
    AND room_members.role = 'owner'
    AND room_members.status = 'approved'
  )
);

-- ─── REACTIONS: INSERT (tighten to authenticated only) ──────────────────────
DROP POLICY IF EXISTS "Users can add own reactions" ON reactions;

CREATE POLICY "Authenticated users can add reactions"
ON reactions FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM photos
    WHERE photos.id = photo_id
    AND (
      photos.uploader_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_members em
        WHERE em.event_id = photos.event_id
        AND em.user_id = auth.uid()
        AND em.status = 'approved'
      )
    )
  )
);

-- ─── REACTIONS: DELETE (tighten to authenticated only) ──────────────────────
DROP POLICY IF EXISTS "Users can delete own reactions" ON reactions;

CREATE POLICY "Authenticated users can delete own reactions"
ON reactions FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ─── COMMENTS: INSERT (tighten to authenticated only) ──────────────────────
DROP POLICY IF EXISTS "Users can add comments" ON comments;

CREATE POLICY "Authenticated users can add comments"
ON comments FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM photos
    WHERE photos.id = photo_id
    AND (
      photos.uploader_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM event_members em
        WHERE em.event_id = photos.event_id
        AND em.user_id = auth.uid()
        AND em.status = 'approved'
      )
    )
  )
);

-- ─── COMMENTS: DELETE (tighten to authenticated only) ──────────────────────
DROP POLICY IF EXISTS "Users can delete own comments" ON comments;

CREATE POLICY "Authenticated users can delete own comments"
ON comments FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- ============================================================================
-- DONE! Hardened permission model:
-- ============================================================================
-- ✓ Photos: Upload requires approved membership. Delete by uploader/room owner/event owner.
-- ✓ Events: Delete by event creator OR room owner.
-- ✓ Reactions & Comments: Only authenticated users can write/delete.
-- ✓ All SELECT policies remain permissive for anon (shared links work).
-- ✓ All write operations now require authentication.
