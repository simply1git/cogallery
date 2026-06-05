-- ============================================================================
-- COGALLERY FIX: Update Storage Usage Trigger
-- ============================================================================
-- The old trigger function was trying to use `OLD.size` which doesn't exist
-- on the photos table. The correct column name is `file_size_bytes`.

CREATE OR REPLACE FUNCTION update_storage_usage()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment photo count and storage size for the user's contribution
    INSERT INTO user_contributions (room_id, user_id, photo_count, total_size_bytes, last_upload_at)
    VALUES (NEW.room_id, NEW.uploader_id, 1, COALESCE(NEW.file_size_bytes, 0), NOW())
    ON CONFLICT (room_id, user_id) DO UPDATE SET 
      photo_count = user_contributions.photo_count + 1,
      total_size_bytes = user_contributions.total_size_bytes + COALESCE(NEW.file_size_bytes, 0),
      last_upload_at = NOW();
      
    RETURN NEW;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement photo count and storage size for the user's contribution
    UPDATE user_contributions 
    SET 
      photo_count = GREATEST(user_contributions.photo_count - 1, 0),
      total_size_bytes = GREATEST(user_contributions.total_size_bytes - COALESCE(OLD.file_size_bytes, 0), 0)
    WHERE room_id = OLD.room_id AND user_id = OLD.uploader_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$;
