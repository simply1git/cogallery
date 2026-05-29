-- ============================================================================
-- COGALLERY: CREATE USER PROFILE RPC
-- Run this script in the Supabase SQL Editor to allow fetching public profiles
-- ============================================================================

CREATE OR REPLACE FUNCTION get_user_profile(profile_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user RECORD;
BEGIN
  -- We fetch just the id, email, and raw_user_meta_data from auth.users
  SELECT id, email, raw_user_meta_data
  INTO v_user
  FROM auth.users
  WHERE id = profile_id;

  IF FOUND THEN
    RETURN json_build_object(
      'id', v_user.id,
      'email', v_user.email,
      'display_name', v_user.raw_user_meta_data->>'displayName',
      'avatar_url', v_user.raw_user_meta_data->>'avatarUrl'
    );
  ELSE
    RETURN NULL;
  END IF;
END;
$$;
