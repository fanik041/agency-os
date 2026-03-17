-- Remove duplicate leads by name (case-insensitive).
-- Keeps the oldest row per name, merges non-null columns from duplicates into the keeper, then deletes duplicates.

-- Step 1: Merge non-null values from duplicates into the keeper (oldest row per name)
WITH ranked AS (
  SELECT *,
    ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY created_at ASC) AS rn
  FROM leads
),
keepers AS (
  SELECT id, LOWER(TRIM(name)) AS name_key FROM ranked WHERE rn = 1
),
duplicates AS (
  SELECT r.*, k.id AS keeper_id
  FROM ranked r
  JOIN keepers k ON LOWER(TRIM(r.name)) = k.name_key
  WHERE r.rn > 1
)
UPDATE leads SET
  website        = COALESCE(leads.website,        d.website),
  phone          = COALESCE(leads.phone,           d.phone),
  address        = COALESCE(leads.address,         d.address),
  city           = COALESCE(leads.city,            d.city),
  niche          = COALESCE(leads.niche,           d.niche),
  rating         = COALESCE(leads.rating,          d.rating),
  review_count   = GREATEST(leads.review_count,    d.review_count),
  maps_url       = COALESCE(leads.maps_url,        d.maps_url),
  email_found    = COALESCE(leads.email_found,     d.email_found),
  reviews_raw    = COALESCE(leads.reviews_raw,     d.reviews_raw),
  pain_score     = COALESCE(leads.pain_score,      d.pain_score),
  pain_points    = COALESCE(leads.pain_points,     d.pain_points),
  suggested_angle = COALESCE(leads.suggested_angle, d.suggested_angle),
  message_draft  = COALESCE(leads.message_draft,   d.message_draft),
  notes          = COALESCE(leads.notes,           d.notes),
  page_load_ms   = COALESCE(leads.page_load_ms,   d.page_load_ms),
  mobile_friendly = COALESCE(leads.mobile_friendly, d.mobile_friendly),
  has_ssl        = COALESCE(leads.has_ssl,         d.has_ssl),
  seo_issues     = COALESCE(leads.seo_issues,      d.seo_issues),
  has_cta        = COALESCE(leads.has_cta,         d.has_cta),
  phone_on_site  = COALESCE(leads.phone_on_site,   d.phone_on_site),
  hours_on_site  = COALESCE(leads.hours_on_site,   d.hours_on_site),
  has_social_proof = COALESCE(leads.has_social_proof, d.has_social_proof),
  tech_stack     = COALESCE(leads.tech_stack,      d.tech_stack),
  "analyze"      = COALESCE(leads."analyze",       d."analyze"),
  site_quality   = COALESCE(leads.site_quality,    d.site_quality),
  follow_up_date = COALESCE(leads.follow_up_date,  d.follow_up_date),
  source_id      = COALESCE(leads.source_id,       d.source_id)
FROM duplicates d
WHERE leads.id = d.keeper_id;

-- Step 2: Delete all duplicate rows (keep only the oldest per name)
DELETE FROM leads
WHERE id IN (
  SELECT id FROM (
    SELECT id,
      ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY created_at ASC) AS rn
    FROM leads
  ) ranked
  WHERE rn > 1
);
