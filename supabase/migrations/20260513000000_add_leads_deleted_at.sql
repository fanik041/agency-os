-- Soft-delete column for CRM tab.
-- All read queries must filter `deleted_at IS NULL` by default.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS deleted_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS leads_deleted_at_active_idx
  ON leads (deleted_at)
  WHERE deleted_at IS NULL;
