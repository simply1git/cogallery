-- ============================================================================
-- COGALLERY: P2P MIGRATION
-- Run this in the Supabase SQL Editor.
-- Adds thumbnail_base64 column for storing tiny preview thumbnails (~10KB)
-- directly in the database, eliminating the need for cloud storage thumbnails.
-- ============================================================================

ALTER TABLE photos ADD COLUMN IF NOT EXISTS thumbnail_base64 TEXT;
