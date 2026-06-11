-- Allow users to update their own photos, or event owners to update any photo
CREATE POLICY "Users can update their own photos"
ON photos
FOR UPDATE
TO authenticated, anon
USING (
  uploader_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = photos.event_id
    AND events.owner_id = auth.uid()
  )
)
WITH CHECK (
  uploader_id = auth.uid()
  OR
  EXISTS (
    SELECT 1 FROM events
    WHERE events.id = photos.event_id
    AND events.owner_id = auth.uid()
  )
);
