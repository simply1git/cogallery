# CoGallery Baseline Migration Summary

## Problem
The CoGallery application was experiencing database errors due to missing tables and columns. Specifically:
- Missing `profiles` table causing invite-by-email functionality to fail
- Missing columns in various tables causing RPC function failures
- Missing database functions required by the application services

## Solution
Created a comprehensive baseline migration script (`000_MISSING_SCHEMA_BASELINE.sql`) that establishes all required database objects before any other migrations are applied.

## Contents of Baseline Migration

### Extensions Enabled
- `uuid-ossp` for UUID generation
- `pgcrypto` for cryptographic functions

### Tables Created

1. **rooms** - Top-level containers for trips/vacations
   - id, creator_id, name, description, timestamps
   - thumbnail_url, archival fields, vault fields, permissions JSONB

2. **room_members** - Users belonging to rooms
   - id, room_id, user_id, role, status, invitation fields, timestamps

3. **events** - Activities within rooms
   - id, room_id, creator_id, title, description, notes, timestamps
   - archive_status, GitHub integration fields, archived_at

4. **event_members** - Users participating in events
   - id, event_id, user_id, role, status, joined_at, timestamps

5. **photos** - Media uploaded to events
   - id, event_id, room_id, uploader_id, filename, metadata
   - S3 storage fields, thumbnail fields, EXIF data, encryption flag

6. **reactions** - Emoji reactions to photos
   - id, photo_id, user_id, emoji, timestamp

7. **comments** - Text comments on photos
   - id, photo_id, user_id, body, timestamps

8. **user_contributions** - Storage statistics per user per room
   - id, room_id, user_id, photo/video counts, size totals, last upload

9. **activity_log** - Audit trail of room activities
   - id, room_id, user_id, action, object details, timestamp

10. **storage_nodes** - Track active storage nodes for P2P
    - id, node_url, last_heartbeat

11. **profiles** - User profile data (extends auth.users)
    - id (FK to auth.users), email, display_name, avatar_url
    - timestamps, is_admin, storage quotas, account status

12. **global_config** - System-wide configuration flags
    - maintenance_mode, signups_disabled, read_only_mode

13. **invite_links** - Secure invite tokens for rooms/events
    - id, token, room_id/event_id, expiration, creator, timestamps
    - CHECK constraint ensures either room_id or event_id is set

### RPC Functions Created

1. **is_admin(user_uid)** - Check if user is admin
2. **admin_get_all_users()** - Get all users with admin fields
3. **admin_update_quota(target_uid, new_quota)** - Update user storage quota
4. **admin_toggle_ban(target_uid, ban_status)** - Ban/unban user
5. **admin_update_global_config(m_mode, s_disabled, r_mode)** - Update system config
6. **admin_delete_user(user_id)** - Delete user from auth system
7. **get_db_size()** - Get database size information
8. **get_table_counts()** - Get row counts for main tables
9. **get_user_profile(user_id)** - Get complete user profile
10. **get_active_node()** - Get storage nodes with recent heartbeat
11. **get_triggers()** - Get database trigger information
12. **exec_sql(query)** - Execute arbitrary SQL (use with caution)

## Verification
- All tables and columns referenced in the application code analysis are present
- Data types match expectations from TypeScript interfaces and service code
- RPC functions match those called in adminService.ts and other services
- Proper foreign key constraints with CASCADE deletes where appropriate
- Row Level Security (RLS) policies can be added subsequently by other migrations
- The migration uses `CREATE TABLE IF NOT EXISTS` and `CREATE OR REPLACE FUNCTION` to be idempotent

## Application Compatibility
This baseline migration resolves dependencies for:
- Client services: roomService.ts, eventService.ts, photoService.ts, adminService.ts
- Bot server: admin checking, profile lookups
- Invite-by-email functionality (requires profiles table)
- All RPC-based admin functions
- Storage quota and banning systems
- Global configuration system

## Usage
This migration should be executed first in the migration sequence, before any other migrations that might depend on these tables or functions.