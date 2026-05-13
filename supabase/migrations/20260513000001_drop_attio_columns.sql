-- Drop Attio sync columns from leads. Attio integration removed.
-- Run only after the dashboard + scraper-service are deployed without Attio code.

ALTER TABLE leads DROP COLUMN IF EXISTS attio_sync_status;
ALTER TABLE leads DROP COLUMN IF EXISTS attio_synced_at;
ALTER TABLE leads DROP COLUMN IF EXISTS attio_id;

DROP TYPE IF EXISTS attio_sync_status;
