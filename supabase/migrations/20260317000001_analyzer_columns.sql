-- New columns for website analysis signals from the /analyze endpoint.
-- Column names are human-readable for clarity in both Supabase and Attio.

ALTER TABLE leads ADD COLUMN IF NOT EXISTS page_load_ms integer;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS mobile_friendly boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_ssl boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS seo_issues text;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_cta boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS phone_on_site boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS hours_on_site boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS has_social_proof boolean;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS tech_stack text;
