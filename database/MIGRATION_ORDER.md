# CoGallery Database Migration Order

Run these in the **Supabase SQL Editor** in order. For fresh installs, run `SCHEMA_MIGRATION_HIERARCHICAL.sql` first.

## Fresh install

1. `SCHEMA_MIGRATION_HIERARCHICAL.sql`
2. `RLS_POLICIES_HIERARCHICAL.sql` or `POLISH_RLS_POLICIES.sql`
3. `FIX_EVENT_ACCESS_AND_PROFILES.sql`
4. `VAULT_SCHEMA_UPDATE.sql`
5. `ADD_P2P_COLUMNS.sql`
6. `ADD_DELETION_THUMBNAILS.sql`
7. `ADD_SOCIAL_ENGAGEMENT.sql`
8. `ADD_ACTIVITY_TRIGGERS.sql`
9. `FIX_CANVAS_RLS.sql` — **required** for canvas security
10. `CREATE_USER_PROFILE_RPC.sql`
11. `000_MISSING_SCHEMA_BASELINE.sql` — tables/RPCs used by app code
12. `exif_migration.sql` — adds EXIF metadata columns for timeline grouping
13. `ADD_ROOM_PERMISSIONS.sql` — adds permissions to rooms (includes PostgREST schema reload)

## Existing deployments (schema drift fix)

If the app is already running, run only:

1. `000_MISSING_SCHEMA_BASELINE.sql`
2. `FIX_CANVAS_RLS.sql` (if not already applied)
3. `exif_migration.sql` (adds EXIF metadata columns)
4. `ADD_ROOM_PERMISSIONS.sql` (adds permissions to rooms)

## Deprecated (do not run on new installs)

These are superseded by the baseline and polish migrations:

- `FIX_RLS_POLICIES.sql`
- `FIX_RLS_POLICIES_FINAL.sql`
- `FIX_RLS_POLICIES_HIERARCHICAL.sql`
- `FIX_INFINITE_RECURSION.sql` (only if you hit recursion errors on old DBs)

## Verification

After migrations, confirm these exist:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  AND tablename IN ('profiles', 'global_config', 'storage_nodes', 'invite_links');

SELECT proname FROM pg_proc WHERE proname IN (
  'get_active_node', 'is_admin', 'validate_invite_token', 'create_invite_link'
);
```
