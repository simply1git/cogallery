-- ============================================================================
-- COGALLERY: ADD ACTIVITY TRIGGERS
-- Run this script in the Supabase SQL Editor to enable the Activity Feed.
-- ============================================================================

-- 1. Photo Uploads
CREATE OR REPLACE FUNCTION log_photo_upload()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO activity_log (room_id, user_id, action, object_type, object_id, details)
  VALUES (
    NEW.room_id, 
    NEW.uploader_id, 
    'photo_uploaded', 
    'photo', 
    NEW.id, 
    jsonb_build_object('event_id', NEW.event_id, 'media_type', NEW.media_type)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_photo_upload ON photos;
CREATE TRIGGER trigger_log_photo_upload
AFTER INSERT ON photos
FOR EACH ROW EXECUTE FUNCTION log_photo_upload();

-- 2. Reactions
CREATE OR REPLACE FUNCTION log_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id UUID;
  v_event_id UUID;
BEGIN
  SELECT room_id, event_id INTO v_room_id, v_event_id FROM photos WHERE id = NEW.photo_id;
  
  INSERT INTO activity_log (room_id, user_id, action, object_type, object_id, details)
  VALUES (
    v_room_id, 
    NEW.user_id, 
    'reaction_added', 
    'reaction', 
    NEW.id, 
    jsonb_build_object('photo_id', NEW.photo_id, 'emoji', NEW.emoji)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_reaction ON reactions;
CREATE TRIGGER trigger_log_reaction
AFTER INSERT ON reactions
FOR EACH ROW EXECUTE FUNCTION log_reaction();

-- 3. Comments
CREATE OR REPLACE FUNCTION log_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_room_id UUID;
  v_event_id UUID;
BEGIN
  SELECT room_id, event_id INTO v_room_id, v_event_id FROM photos WHERE id = NEW.photo_id;
  
  INSERT INTO activity_log (room_id, user_id, action, object_type, object_id, details)
  VALUES (
    v_room_id, 
    NEW.user_id, 
    'comment_added', 
    'comment', 
    NEW.id, 
    jsonb_build_object('photo_id', NEW.photo_id)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_comment ON comments;
CREATE TRIGGER trigger_log_comment
AFTER INSERT ON comments
FOR EACH ROW EXECUTE FUNCTION log_comment();
