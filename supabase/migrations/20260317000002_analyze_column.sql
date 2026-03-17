-- Single text column to store the full /analyze JSON response per lead.
ALTER TABLE leads ADD COLUMN IF NOT EXISTS "analyze" text;
