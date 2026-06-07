-- Add End-to-End Encryption fields to the rooms table
ALTER TABLE rooms 
ADD COLUMN IF NOT EXISTS is_vault BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS vault_salt TEXT,
ADD COLUMN IF NOT EXISTS vault_hash TEXT;

-- For files inside a vault, we also need to know they are encrypted
-- Actually, we can just infer this if they belong to an event in a vault room.
-- But it's safer to mark the photos explicitly in case they move rooms (unlikely)
ALTER TABLE photos
ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;
