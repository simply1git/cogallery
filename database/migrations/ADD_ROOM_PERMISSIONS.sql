-- Add permissions JSONB column to the rooms table
ALTER TABLE public.rooms 
ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '{"canUpload": true, "canDeleteOwn": true, "canDeleteOthers": false, "canInvite": true, "canManageEvents": true, "canChangeSettings": true, "canViewAnalytics": true}'::jsonb;

-- Reload the PostgREST schema cache so the API immediately recognizes the new column
NOTIFY pgrst, 'reload schema';
