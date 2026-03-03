-- CONTACTS table (decision makers found via research)
CREATE TABLE IF NOT EXISTS contacts (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  source text,
  confidence int check (confidence between 1 and 5),
  notes text,
  tags text[] default '{}',
  created_at timestamptz default now()
);

CREATE INDEX IF NOT EXISTS contacts_lead_id_idx ON contacts(lead_id);
CREATE INDEX IF NOT EXISTS contacts_tags_idx ON contacts USING gin(tags);

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'contacts' AND policyname = 'Allow authenticated full access to contacts'
  ) THEN
    CREATE POLICY "Allow authenticated full access to contacts" ON contacts FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- RESEARCH_JOBS table
CREATE TABLE IF NOT EXISTS research_jobs (
  id uuid primary key default uuid_generate_v4(),
  status text default 'queued' check (status in ('queued','running','done','failed')),
  lead_ids uuid[] not null,
  total int default 0,
  processed int default 0,
  contacts_found int default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

ALTER TABLE research_jobs ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'research_jobs' AND policyname = 'Allow authenticated full access to research_jobs'
  ) THEN
    CREATE POLICY "Allow authenticated full access to research_jobs" ON research_jobs FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- LEAD_SOURCES table
CREATE TABLE IF NOT EXISTS lead_sources (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('scrape','import','manual')),
  label text not null,
  scrape_job_id uuid references scrape_jobs(id),
  leads_count int default 0,
  created_at timestamptz default now()
);

ALTER TABLE leads ADD COLUMN IF NOT EXISTS source_id uuid references lead_sources(id);
CREATE INDEX IF NOT EXISTS leads_source_id_idx ON leads(source_id);

ALTER TABLE lead_sources ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'lead_sources' AND policyname = 'Allow authenticated full access to lead_sources'
  ) THEN
    CREATE POLICY "Allow authenticated full access to lead_sources" ON lead_sources FOR ALL USING (auth.role() = 'authenticated');
  END IF;
END $$;
