-- ============================================================================
-- COGALLERY: Wipe All Platform Data (Safe Reset)
-- ============================================================================
-- This script safely deletes all rooms, events, photos, and comments, 
-- giving you a completely fresh start. 
-- It keeps your registered user accounts intact so you don't have to sign up again.

-- 1. Truncate the rooms table. 
-- Because we set up "ON DELETE CASCADE", deleting rooms will automatically
-- delete all events, photos, comments, reactions, and memberships inside them!
TRUNCATE rooms CASCADE;

-- 2. Clean up any leftover activity logs or contributions
TRUNCATE activity_log CASCADE;
TRUNCATE user_contributions CASCADE;

-- 3. Reset the system configuration (optional, just to be safe)
UPDATE global_config SET maintenance_mode = false, signups_disabled = false, read_only_mode = false;

-- You are now ready to start fresh!
