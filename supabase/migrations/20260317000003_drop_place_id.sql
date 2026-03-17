-- Remove place_id column from leads table.
-- The Attio "place_id" field now maps to the "address" column instead.
ALTER TABLE leads DROP COLUMN IF EXISTS place_id;
