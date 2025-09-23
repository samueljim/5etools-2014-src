-- Migration to add user_id column to characters table

-- First, let's add the user_id column to characters table
ALTER TABLE characters ADD COLUMN user_id INTEGER REFERENCES users(id);

-- For existing characters without user_id, we'll need to either:
-- 1. Delete them (since we can't associate them with a user), or 
-- 2. Associate them with the first user in the system
-- Let's go with option 2 for backward compatibility

-- Update existing characters to use the first user's ID (if any users exist)
UPDATE characters 
SET user_id = (SELECT id FROM users ORDER BY created_at LIMIT 1)
WHERE user_id IS NULL 
AND EXISTS (SELECT 1 FROM users);

-- If no users exist, we'll leave the characters as they are for now
-- They can be cleaned up later or associated with users when they're created