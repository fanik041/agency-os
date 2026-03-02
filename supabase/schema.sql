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
