-- Add Attio CRM integration columns and new lead fields.
-- Renames call_status → status, adds enrichment/scoring fields.

-- New lead status type
DO $$ BEGIN
  CREATE TYPE lead_status AS ENUM ('new', 'scoring', 'needs_review', 'approved', 'sent', 'replied', 'booked', 'closed', 'skip');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- New attio sync status type
DO $$ BEGIN
  CREATE TYPE attio_sync_status AS ENUM ('not_synced', 'synced', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add new columns
ALTER TABLE leads ADD COLUMN IF NOT EXISTS status lead_status NOT NULL DEFAULT 'new';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS place_id text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_booking boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_chat_widget boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_contact_form boolean NOT NULL DEFAULT false;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS reviews_raw text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pain_score integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS pain_points text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS suggested_angle text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS message_draft text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS email_found text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS attio_sync_status attio_sync_status NOT NULL DEFAULT 'not_synced';
ALTER TABLE leads ADD COLUMN IF NOT EXISTS attio_synced_at timestamptz;
