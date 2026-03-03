-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- LEADS table
create table if not exists leads (
  id uuid primary key default uuid_generate_v4(),
  niche text,
  name text not null,
  phone text,
  address text,
  email text,
  website text,
  rating numeric(3,1),
  review_count int default 0,
  maps_url text,
  city text,
  has_website boolean default false,
  site_quality int check (site_quality between 1 and 5),
  call_status text default 'pending' check (
    call_status in ('pending','called','callback','interested','closed','dead')
  ),
  call_notes text,
  called_at timestamptz,
  created_at timestamptz default now()
);

-- CLIENTS table
create table if not exists clients (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id),
  business_name text not null,
  contact_name text,
  phone text,
  email text,
  niche text,
  city text,
  site_url text,
  github_repo text,
  vercel_project_id text,
  deal_value numeric(10,2),
  paid_upfront numeric(10,2) default 0,
  paid_final numeric(10,2) default 0,
  retainer_amount numeric(10,2) default 0,
  retainer_active boolean default false,
  retainer_billing_day int check (retainer_billing_day between 1 and 28),
  site_status text default 'building' check (
    site_status in ('building','live','paused')
  ),
  created_at timestamptz default now()
);

-- SCRAPE_JOBS table
create table if not exists scrape_jobs (
  id uuid primary key default uuid_generate_v4(),
  niches text[] not null,
  location text not null,
  city text,
  max_per_niche int default 50,
  with_emails boolean default false,
  status text default 'queued' check (
    status in ('queued','running','done','failed')
  ),
  leads_found int default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

-- CALL_LOG table
create table if not exists call_log (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) not null,
  outcome text check (
    outcome in ('no_answer','voicemail','not_interested','callback_requested','demo_booked','closed')
  ),
  notes text,
  duration_seconds int,
  called_at timestamptz default now()
);

-- REVENUE_EVENTS table
create table if not exists revenue_events (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) not null,
  type text check (type in ('deposit','final','retainer')),
  amount numeric(10,2) not null,
  date date not null,
  notes text
);

-- Unique constraint for upsert-by-maps_url
create unique index if not exists leads_maps_url_unique on leads(maps_url);

-- Indexes for common queries
create index if not exists leads_call_status_idx on leads(call_status);
create index if not exists leads_site_quality_idx on leads(site_quality);
create index if not exists leads_niche_idx on leads(niche);
create index if not exists leads_city_idx on leads(city);
create index if not exists clients_site_status_idx on clients(site_status);
create index if not exists scrape_jobs_status_idx on scrape_jobs(status);

-- Enable Row Level Security
alter table leads enable row level security;
alter table clients enable row level security;
alter table scrape_jobs enable row level security;
alter table call_log enable row level security;
alter table revenue_events enable row level security;

-- RLS Policies (service role bypasses these, anon needs auth)
-- Allow authenticated users full access
create policy "Allow authenticated full access to leads"
  on leads for all using (auth.role() = 'authenticated');

create policy "Allow authenticated full access to clients"
  on clients for all using (auth.role() = 'authenticated');

create policy "Allow authenticated full access to scrape_jobs"
  on scrape_jobs for all using (auth.role() = 'authenticated');

create policy "Allow authenticated full access to call_log"
  on call_log for all using (auth.role() = 'authenticated');

create policy "Allow authenticated full access to revenue_events"
  on revenue_events for all using (auth.role() = 'authenticated');

-- CONTACTS table (decision makers found via research)
create table if not exists contacts (
  id uuid primary key default uuid_generate_v4(),
  lead_id uuid references leads(id) on delete cascade,
  name text not null,
  title text,
  email text,
  phone text,
  linkedin_url text,
  source text, -- 'google_linkedin', 'website_about', 'website_contact', 'manual'
  confidence int check (confidence between 1 and 5), -- 5 = high
  notes text,
  created_at timestamptz default now()
);

-- RESEARCH_JOBS table (tracks advanced search batch jobs)
create table if not exists research_jobs (
  id uuid primary key default uuid_generate_v4(),
  status text default 'queued' check (
    status in ('queued','running','done','failed')
  ),
  lead_ids uuid[] not null,
  total int default 0,
  processed int default 0,
  contacts_found int default 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz default now()
);

-- Add tags to contacts
alter table contacts add column if not exists tags text[] default '{}';
create index if not exists contacts_tags_idx on contacts using gin(tags);

-- Indexes for contacts
create index if not exists contacts_lead_id_idx on contacts(lead_id);

-- Enable RLS on new tables
alter table contacts enable row level security;
alter table research_jobs enable row level security;

create policy "Allow authenticated full access to contacts"
  on contacts for all using (auth.role() = 'authenticated');

create policy "Allow authenticated full access to research_jobs"
  on research_jobs for all using (auth.role() = 'authenticated');

-- LEAD_SOURCES table (tracks which scrape/import produced which leads)
create table if not exists lead_sources (
  id uuid primary key default uuid_generate_v4(),
  type text not null check (type in ('scrape','import','manual')),
  label text not null,
  scrape_job_id uuid references scrape_jobs(id),
  leads_count int default 0,
  created_at timestamptz default now()
);

-- Add source_id to leads
alter table leads add column if not exists source_id uuid references lead_sources(id);
create index if not exists leads_source_id_idx on leads(source_id);

-- Enable RLS on lead_sources
alter table lead_sources enable row level security;

create policy "Allow authenticated full access to lead_sources"
  on lead_sources for all using (auth.role() = 'authenticated');
