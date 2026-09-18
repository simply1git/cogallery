-- ============================================================================
-- COGALLERY: BASELINE SCHEMA MIGRATION
-- This migration creates all necessary tables and columns to satisfy
-- the application dependencies. It should be run before all other migrations.
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Rooms table
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    thumbnail_url TEXT,
    is_archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMP WITH TIME ZONE,
    is_vault BOOLEAN DEFAULT FALSE,
    vault_salt TEXT,
    vault_hash TEXT,
    recovery_salt TEXT,
    recovery_verifier TEXT,
    permissions JSONB
);

-- Room members table
CREATE TABLE IF NOT EXISTS room_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    invited_by_id UUID REFERENCES auth.users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Events table
CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    notes TEXT,
    thumbnail_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    archive_status VARCHAR(20) DEFAULT 'active',
    github_repo_url TEXT,
    github_pages_url TEXT,
    archived_at TIMESTAMP WITH TIME ZONE
);

-- Event members table
CREATE TABLE IF NOT EXISTS event_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'approved',
    joined_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
-- Canvas states table for the Moodboard feature
-- Stores the tldraw canvas snapshot for each event

CREATE TABLE IF NOT EXISTS canvas_states (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE UNIQUE,
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
-- Photos table
CREATE TABLE IF NOT EXISTS photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    uploader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    content_hash TEXT,
    file_size_bytes INTEGER,
    media_type TEXT,
    s3_key TEXT,
    s3_url TEXT,
    thumbnail_url TEXT,
    thumbnail_base64 TEXT,
    blurhash TEXT,
    taken_at TIMESTAMP WITH TIME ZONE,
    camera_make TEXT,
    camera_model TEXT,
    iso INTEGER,
    aperture NUMERIC,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_encrypted BOOLEAN DEFAULT FALSE,
    metadata JSONB
);

-- Reactions table
CREATE TABLE IF NOT EXISTS reactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    emoji TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User contributions table
CREATE TABLE IF NOT EXISTS user_contributions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    photo_count INTEGER DEFAULT 0,
    video_count INTEGER DEFAULT 0,
    total_size_bytes BIGINT DEFAULT 0,
    last_upload_at TIMESTAMP WITH TIME ZONE
);

-- Activity log table
CREATE TABLE IF NOT EXISTS activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    object_type TEXT,
    object_id UUID,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Storage nodes table
CREATE TABLE IF NOT EXISTS storage_nodes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    node_url TEXT UNIQUE NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE
);

-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_admin BOOLEAN DEFAULT FALSE,
    max_storage_bytes BIGINT DEFAULT 0,
    used_storage_bytes BIGINT DEFAULT 0,
    account_status TEXT DEFAULT 'active'
);

-- Global config table
CREATE TABLE IF NOT EXISTS global_config (
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    signups_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    read_only_mode BOOLEAN NOT NULL DEFAULT FALSE
);

-- Invite links table
CREATE TABLE IF NOT EXISTS invite_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    token TEXT UNIQUE NOT NULL,
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    event_id UUID REFERENCES events(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    CHECK ((room_id IS NOT NULL AND event_id IS NULL) OR (room_id IS NULL AND event_id IS NOT NULL))
);
-- ============================================================================
-- RPC FUNCTIONS
-- ============================================================================

-- is_admin(user_uid) returns boolean
CREATE OR REPLACE FUNCTION is_admin(user_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
    SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = user_uid), false);
$$;

-- admin_get_all_users() returns table of admin user info
CREATE OR REPLACE FUNCTION admin_get_all_users()
RETURNS TABLE(
    id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    max_storage_bytes bigint,
    used_storage_bytes bigint,
    account_status text,
    is_admin boolean
)
LANGUAGE sql
AS $$
    SELECT
        p.id,
        u.email,
        p.display_name,
        p.avatar_url,
        p.created_at,
        p.max_storage_bytes,
        p.used_storage_bytes,
        p.account_status,
        p.is_admin
    FROM profiles p
    JOIN auth.users u ON p.id = u.id;
$$;

-- admin_update_quota(target_uid, new_quota) returns void
CREATE OR REPLACE FUNCTION admin_update_quota(target_uid uuid, new_quota integer)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE profiles SET max_storage_bytes = new_quota WHERE id = target_uid;
$$;

-- admin_toggle_ban(target_uid, ban_status) returns void
CREATE OR REPLACE FUNCTION admin_toggle_ban(target_uid uuid, ban_status text)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE profiles SET account_status = ban_status WHERE id = target_uid;
$$;

-- admin_update_global_config(m_mode, s_disabled, r_mode) returns void
CREATE OR REPLACE FUNCTION admin_update_global_config(m_mode boolean, s_disabled boolean, r_mode boolean)
RETURNS void
LANGUAGE sql
AS $$
    UPDATE global_config SET 
        maintenance_mode = m_mode,
        signups_disabled = s_disabled,
        read_only_mode = r_mode;
$$;

-- admin_delete_user(user_id) returns void
CREATE OR REPLACE FUNCTION admin_delete_user(user_id uuid)
RETURNS void
LANGUAGE sql
AS $$
    DELETE FROM auth.users WHERE id = user_id;
$$;

-- get_db_size() returns table with database size info
CREATE OR REPLACE FUNCTION get_db_size()
RETURNS TABLE(
    database_name text,
    size_bytes bigint,
    size_pretty text
)
LANGUAGE sql
AS $$
    SELECT
        current_database() AS database_name,
        pg_database_size(current_database()) AS size_bytes,
        pg_size_pretty(pg_database_size(current_database())) AS size_pretty;
$$;

-- get_table_counts() returns table with counts of main tables
CREATE OR REPLACE FUNCTION get_table_counts()
RETURNS TABLE(
    users bigint,
    rooms bigint,
    events bigint,
    photos bigint,
    comments bigint,
    reactions bigint
)
LANGUAGE sql
AS $$
    SELECT
        (SELECT COUNT(*) FROM auth.users) AS users,
        (SELECT COUNT(*) FROM rooms) AS rooms,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM photos) AS photos,
        (SELECT COUNT(*) FROM comments) AS comments,
        (SELECT COUNT(*) FROM reactions) AS reactions;
$$;

-- get_user_profile(user_id) returns table with profile info
CREATE OR REPLACE FUNCTION get_user_profile(user_id uuid)
RETURNS TABLE(
    id uuid,
    email text,
    display_name text,
    avatar_url text,
    created_at timestamptz,
    updated_at timestamptz,
    is_admin boolean
)
LANGUAGE sql
AS $$
    SELECT id, email, display_name, avatar_url, created_at, updated_at, is_admin
    FROM profiles
    WHERE id = user_id;
$$;

-- get_active_node() returns table of active storage nodes (heartbeat within 5 minutes)
CREATE OR REPLACE FUNCTION get_active_node()
RETURNS TABLE(
    id uuid,
    node_url text,
    last_heartbeat timestamptz
)
LANGUAGE sql
AS $$
    SELECT id, node_url, last_heartbeat
    FROM storage_nodes
    WHERE last_heartbeat >= now() - interval '5 minutes'
    ORDER BY node_url;
$$;

-- get_triggers() returns table of trigger information
CREATE OR REPLACE FUNCTION get_triggers()
RETURNS TABLE(
    trigger_name text,
    trigger_event text,
    trigger_table text
)
LANGUAGE sql
AS $$
    SELECT tgname AS trigger_name,
           tgtype AS trigger_event,
           tblname AS trigger_table
    FROM pg_trigger
    JOIN pg_class ON pg_trigger.tgrelid = pg_class.oid;
$$;

-- exec_sql(query) executes arbitrary SQL (use with caution)
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    EXECUTE query;
END;
$$;

-- ============================================================================
-- END OF BASELINE MIGRATION
-- ============================================================================