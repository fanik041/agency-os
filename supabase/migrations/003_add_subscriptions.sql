-- Add is_admin to profiles
alter table profiles add column if not exists is_admin boolean default false not null;

-- Set existing users as admin
update profiles set is_admin = true;

-- Create enums
create type subscription_status as enum ('active', 'cancelled', 'past_due');
create type usage_action as enum ('score', 'scrape', 'scrape_large', 'attio_sync', 'lead_overage');

-- Subscription plans table (tier definitions)
create table subscription_plans (
  id text primary key,
  name text not null,
  base_price_cents integer not null default 0,
  max_leads integer,
  max_scores_per_month integer,
  max_scores_lifetime integer,
  max_scrapes_per_month integer,
  max_scrapes_lifetime integer,
  max_scrape_leads_lifetime integer,
  attio_sync_enabled boolean not null default true,
  cost_per_score_cents integer not null default 0,
  cost_per_scrape_cents integer not null default 0,
  cost_per_scrape_large_cents integer not null default 0,
  cost_per_lead_overage_cents integer not null default 0,
  cost_per_attio_sync_cents integer not null default 0,
  created_at timestamptz default now() not null
);

alter table subscription_plans enable row level security;
create policy "Authenticated can read plans" on subscription_plans for select using (auth.role() = 'authenticated');

-- Seed the 4 tiers
insert into subscription_plans (id, name, base_price_cents, max_leads, max_scores_per_month, max_scores_lifetime, max_scrapes_per_month, max_scrapes_lifetime, max_scrape_leads_lifetime, attio_sync_enabled, cost_per_score_cents, cost_per_scrape_cents, cost_per_scrape_large_cents, cost_per_lead_overage_cents, cost_per_attio_sync_cents) values
  ('free',       'Free',       0,      100,  null, 1,    null, 5,    100,  false, 0,  0,  0,   0, 0),
  ('per_use',    'Per Use',    1500,   null, null, null, null, null, null, true,  10, 50, 100, 1, 100),
  ('pro',        'Pro',        10000,  5000, 100,  null, 100,  null, null, true,  0,  0,  0,   0, 0),
  ('enterprise', 'Enterprise', 120000, null, null, null, null, null, null, true,  0,  0,  0,   0, 0);

-- User subscriptions table
create table user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  plan_id text not null references subscription_plans(id) default 'free',
  status subscription_status not null default 'active',
  started_at timestamptz default now() not null,
  expires_at timestamptz,
  created_at timestamptz default now() not null,
  unique(user_id)
);

alter table user_subscriptions enable row level security;
create policy "Users can read own subscription" on user_subscriptions for select using (auth.uid() = user_id);
create policy "Service role full access subscriptions" on user_subscriptions for all using (auth.role() = 'service_role');

-- Create enterprise subscriptions for existing admin users
insert into user_subscriptions (user_id, plan_id, status)
select id, 'enterprise', 'active' from profiles where is_admin = true;

-- Usage records table
create table usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action usage_action not null,
  quantity integer not null default 1,
  cost_cents integer not null default 0,
  period text not null,
  metadata jsonb,
  created_at timestamptz default now() not null
);

create index idx_usage_records_user_period on usage_records(user_id, period);
create index idx_usage_records_user_action on usage_records(user_id, action);

alter table usage_records enable row level security;
create policy "Users can read own usage" on usage_records for select using (auth.uid() = user_id);
create policy "Service role full access usage" on usage_records for all using (auth.role() = 'service_role');
