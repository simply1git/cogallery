# CoGallery Deployment Guide

Taking CoGallery to production involves two main platforms: **Supabase** (Backend/Database) and **Vercel** (Frontend).

## 1. Supabase Production Setup

### A. Environment Configuration
1. Create a new project in the Supabase Dashboard for production (do not use your dev environment).
2. Note your **Project URL** and **anon public API key**.

### B. Database Migration
Instead of running individual SQL scripts, run them in the following order in the Supabase SQL Editor:
1. `SCHEMA_MIGRATION_HIERARCHICAL.sql` (Base tables: Users, Rooms, Events, Photos, Memberships, Activity Log)
2. `RLS_POLICIES_HIERARCHICAL.sql` (Initial Row Level Security Policies)
3. `FIX_RLS_POLICIES_FINAL.sql` (Patches and recursive query fixes)
4. `ADD_DELETION_THUMBNAILS.sql` (Adds `thumbnail_url` columns and deletion functionality)
5. `ADD_SOCIAL_ENGAGEMENT.sql` (Adds `reactions` and `comments` tables + RLS)
6. `ADD_AVATARS_BUCKET.sql` (Creates the avatars bucket)

### C. Storage Buckets
Ensure the following buckets exist in the Supabase Storage dashboard and are set to **Public**:
- `photos`
- `avatars`

### D. Authentication
1. Go to **Authentication > Providers** and ensure Email is enabled.
2. Under **Authentication > URL Configuration**, set your **Site URL** to your production domain (e.g., `https://cogallery.com`).
3. Add any necessary redirect URLs (e.g., `https://cogallery.com/auth/callback`).

---

## 2. Vercel Frontend Deployment

### A. Preparation
1. Ensure your code is pushed to a GitHub repository.
2. The project uses Vite, so the build command is `npm run build` and the output directory is `dist`.

### B. Deploying to Vercel
1. Log in to [Vercel](https://vercel.com) and click **Add New > Project**.
2. Import your GitHub repository.
3. Vercel should automatically detect that this is a **Vite** project.
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Expand the **Environment Variables** section and add:
   - `VITE_SUPABASE_URL`: Your Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY`: Your Supabase anon key

### C. Launch
1. Click **Deploy**.
2. Once the build finishes, Vercel will assign a `.vercel.app` domain. 
3. If you have a custom domain, go to the project's **Settings > Domains** in Vercel to attach it.

---

## 3. Post-Deployment Checklist

- [ ] **Test Auth:** Try signing up, logging in, and resetting a password on the live site.
- [ ] **Test Uploads:** Upload a photo and confirm it saves to the Supabase `photos` bucket.
- [ ] **Test Avatars:** Go to Profile Settings and change the avatar to confirm the `avatars` bucket policies are working.
- [ ] **Test Batch Download:** Ensure the "Download All" `.zip` generation doesn't crash the browser on production (Vite optimizes JSZip).
- [ ] **Test Invites:** Copy an invite link and open it in an incognito window to verify routing.
