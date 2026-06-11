# CoGallery Phase 1 - RLS Fix & Verification Guide

## Current Status

✅ **Frontend Complete:**
- Authentication (guest/email login)
- Event creation with QR code generation
- Upload Zone component (drag-drop, progress, validation)
- Dark theme design system
- Protected routes

🔴 **Blocking Issue:** Event pages return 403 errors due to RLS policy recursion

---

## How to Fix (4 Steps)

### Step 1: Open Supabase Dashboard

1. Go to https://app.supabase.com
2. Select your project: **cogallery-dev**
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**

### Step 2: Paste the Fix SQL

1. Copy the entire contents of `FIX_RLS_POLICIES_FINAL.sql` from project root
2. Paste into the SQL Editor
3. Click **Run** button

You should see: **"Executing..."** → **"Success"**

### Step 3: Verify Policies Updated

Run this optional check in a new SQL query:

```sql
SELECT tablename, policyname, permissive, roles 
FROM pg_policies 
WHERE tablename IN ('events', 'photos', 'event_members') 
ORDER BY tablename, policyname;
```

Expected result: All policies should have `roles = '{authenticated,anon}'` or just `'{anon}'`

### Step 4: Test in App

1. Refresh browser: http://localhost:5173
2. Click **Get Started** → **Continue as Guest** → enter name
3. Click **Create Event** → fill title/description → click **Create Event**
4. Click **Go to Event**

**Expected:**
- ✅ Event page loads (title, description, code visible)
- ✅ Upload Zone component appears with drag-drop area
- ✅ Can drag/drop test photos
- ✅ Progress bar shows during upload
- ✅ Success message on completion

---

## If It Still Doesn't Work

**Error: Still 403 when loading event?**

Run this diagnostic query:

```sql
-- Find your test event
SELECT id, code, owner_id, created_at FROM events WHERE code = 'V80S21' LIMIT 1;

-- Then use the returned ID below to check membership
-- (Replace 'EVENT_ID' with the actual UUID from above)
SELECT * FROM event_members WHERE event_id = 'EVENT_ID';
```

If no event_members row exists, run:

```sql
-- Add the owner to event_members (fix if missing)
INSERT INTO event_members (event_id, user_id, role)
SELECT events.id, events.owner_id, 'owner'
FROM events
WHERE events.code = 'V80S21'
AND NOT EXISTS (
  SELECT 1 FROM event_members
  WHERE event_members.event_id = events.id
  AND event_members.user_id = events.owner_id
);
```

---

## Files Created for This Fix

| File | Purpose |
|------|---------|
| `FIX_RLS_POLICIES_FINAL.sql` | Complete RLS fix (run this in Supabase) |
| `RLS_POLICY_FIX_GUIDE.md` | Step-by-step guide (simpler version) |
| `SUPABASE_SETUP.md` | Updated with guest user support |

---

## What the Fix Does

**Fixes infinite recursion** by:
1. Creating `is_event_owner()` SECURITY DEFINER function (runs with elevated privileges)
2. Simplifying event_members policy to avoid recursive checks
3. Using function for permission checks instead of cross-table lookups

**Enables for guest users:**
- ✅ Create events
- ✅ View own events
- ✅ Join events as members
- ✅ Upload photos
- ✅ Add reactions & comments
- ✅ View/manage own data

---

## Next Steps After Verification

Once event pages load successfully:

1. **Photo Gallery Grid** - Display uploaded photos in masonry layout
2. **Real-Time Subscriptions** - Photos appear instantly when uploaded by others
3. **Comments & Reactions** - Add emoji reactions and text comments
4. **Download Functionality** - Single/batch/full event downloads
5. **E2E Testing** - Verify multi-user flows

---

## Reference

- [Supabase RLS Docs](https://supabase.com/docs/guides/auth/row-level-security)
- [SECURITY DEFINER Functions](https://www.postgresql.org/docs/current/sql-createfunction.html)
- Project: CoGallery Phase 1 MVP
- Date: May 28, 2026
