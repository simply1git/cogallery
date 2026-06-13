-- Add blurhash and thumbnail_url columns to photos table
ALTER TABLE photos ADD COLUMN IF NOT EXISTS blurhash TEXT;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
