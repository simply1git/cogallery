# RLS Policy Fix: Guest User Access

## Problem

Event pages show **403 Forbidden** and **406 Not Acceptable** errors when guest users try to view their own events. This happens even though:
- ✅ Event creation works perfectly
- ✅ Guest authentication works
- ✅ Event code/QR code generation works
- ❌ Event retrieval fails with 403 errors

## Root Cause

The RLS (Row-Level Security) policies in Supabase were configured with `TO authenticated` which only allows users with email/password authentication. Guest users created via `signInAsGuest()` don't have the `authenticated` role, so they get rejected.

## Solution

Update all RLS policies to include `anon` role. This allows both:
- `authenticated` - email/password signed-in users
- `anon` - guest/anonymous users

## How to Apply the Fix

### Option 1: Automatic (Recommended)

1. Go to Supabase dashboard: https://app.supabase.com
2. Select your project (cogallery-dev)
3. Click **SQL Editor** (left sidebar)
4. Click **New Query**
5. Copy and paste the contents of `FIX_RLS_POLICIES.sql` from project root
6. Click **Run** button
7. Wait for "Success" message

### Option 2: Manual Policy Updates

For each policy below:
1. Go to Supabase dashboard
2. Click **Authentication** → **Policies** (or SQL Editor)
3. Find the policy
4. Change `TO authenticated` → `TO authenticated, anon`
5. Save

**Policies to update:**
- Events table (4 policies):
  - "Users can view own events"
  - "Members can view event they joined"
  - "Users can create events"
  - "Owners can update own events"

- Photos table (2 policies):
  - "Can view photos in accessible events"
  - "Event members can upload photos"

- Reactions table (2 policies):
  - "Users can add own reactions"
  - "Users can delete own reactions"

- Comments table (2 policies):
  - "Users can create comments"
  - "Users can view comments on accessible photos"

- Event Members table (add if missing):
  - "Users can view event members"

## Testing the Fix

1. Refresh the browser (Ctrl+R)
2. Create a new event as guest user
3. Navigate to event page - should now show:
   - ✅ Event title and description
   - ✅ Photo Gallery section
   - ✅ Upload Zone component (new!)
4. Upload test photos using the drag-drop zone

## After Applying Fix

The UploadZone component will be fully functional:
- Drag & drop file upload
- File validation (images only, max 500MB)
- Progress tracking per file
- Error handling and display
- Success notifications
- Batch upload support

## Files Updated

- `SUPABASE_SETUP.md` - Updated policy documentation
- `FIX_RLS_POLICIES.sql` - SQL script to apply fixes
- This file - `RLS_POLICY_FIX_GUIDE.md`

## References

- [Supabase RLS Documentation](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Anonymous Auth](https://supabase.com/docs/guides/auth/auth-anonymous)
- Project: CoGallery Phase 1 MVP
