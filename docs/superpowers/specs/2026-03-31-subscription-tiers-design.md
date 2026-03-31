# Subscription Tiers — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Goal:** Add a 4-tier subscription system (Free, Per Use, Pro, Enterprise) with usage tracking and feature gating. Admin-managed tiers (no Stripe). Admins bypass all limits.

**Depends on:** Auth + Google OAuth (Sub-project 1) — profiles table must exist.

**Future sub-projects:** Stripe billing (self-serve), Attio multi-project portal.

---

## Constraint

- No Stripe integration — tiers assigned manually by admin
- No billing UI — just enforcement, tracking, and upgrade prompts
- Existing data stays as-is (single tenant, no user_id on data tables yet)
- Admin users bypass all tier limits
- All existing functionality remains identical for admins

## Tier Definitions

| Feature | Free | Per Use ($15/mo + usage) | Pro ($100/mo) | Enterprise ($1200+/mo) |
|---|---|---|---|---|
| **Leads stored** | 100 | 100 free, then $0.01/lead/mo | 5,000 (cap if not upgraded) | Unlimited |
| **Scores** | 1 lifetime | $0.10 per score | 100/month (cap if not upgraded) | Unlimited |
| **Scrape jobs** | 5 lifetime, max 100 leads total (whichever first) | $0.50/job ($1.00 for 50+ leads) | 100/month | Unlimited |
| **Research** | Free | Free | Free | Free |
| **Exports/Imports** | Free | Free | Free | Free |
| **Attio sync** | Blocked | $1.00 per sync | Free | Free |
| **Base price** | $0 | $15/mo | $100/mo | $1,200+/mo (custom, admin decides) |

## Database Changes

### Modify: `profiles` table

Add column:
```sql
alter table profiles add column is_admin boolean default false not null;
```

Set existing users as admin (run once):
```sql
update profiles set is_admin = true;
```

All future sign-ups default to `is_admin = false`.

### New enum: `subscription_status`

```sql
create type subscription_status as enum ('active', 'cancelled', 'past_due');
```

### New enum: `usage_action`

```sql
create type usage_action as enum ('score', 'scrape', 'scrape_large', 'attio_sync', 'lead_overage');
```

### New table: `subscription_plans`

Defines the 4 tiers. Seeded with data, rarely changes.

```sql
create table subscription_plans (
  id text primary key,
  name text not null,
  base_price_cents integer not null default 0,
  max_leads integer,                          -- null = unlimited
  max_scores_per_month integer,               -- null = unlimited
  max_scores_lifetime integer,                -- null = unlimited (free tier uses this)
  max_scrapes_per_month integer,              -- null = unlimited
  max_scrapes_lifetime integer,               -- null = unlimited (free tier uses this)
  max_scrape_leads_lifetime integer,          -- null = unlimited (free tier: 100)
  attio_sync_enabled boolean not null default true,
  cost_per_score_cents integer not null default 0,
  cost_per_scrape_cents integer not null default 0,
  cost_per_scrape_large_cents integer not null default 0,
  cost_per_lead_overage_cents integer not null default 0,
  cost_per_attio_sync_cents integer not null default 0,
  created_at timestamptz default now() not null
);
```

Seed data:

```sql
insert into subscription_plans (id, name, base_price_cents, max_leads, max_scores_per_month, max_scores_lifetime, max_scrapes_per_month, max_scrapes_lifetime, max_scrape_leads_lifetime, attio_sync_enabled, cost_per_score_cents, cost_per_scrape_cents, cost_per_scrape_large_cents, cost_per_lead_overage_cents, cost_per_attio_sync_cents) values
  ('free',       'Free',       0,      100,  null, 1,    null, 5,    100,  false, 0,  0,  0,   0, 0),
  ('per_use',    'Per Use',    1500,   null, null, null, null, null, null, true,  10, 50, 100, 1, 100),
  ('pro',        'Pro',        10000,  5000, 100,  null, 100,  null, null, true,  0,  0,  0,   0, 0),
  ('enterprise', 'Enterprise', 120000, null, null, null, null, null, null, true,  0,  0,  0,   0, 0);
```

### New table: `user_subscriptions`

Links a user to a plan.

```sql
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
```

### New table: `usage_records`

Tracks every metered action for billing and limit enforcement.

```sql
create table usage_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  action usage_action not null,
  quantity integer not null default 1,
  cost_cents integer not null default 0,
  period text not null,                       -- '2026-03' format for monthly aggregation
  metadata jsonb,                             -- optional: scrape job id, lead id, etc.
  created_at timestamptz default now() not null
);

create index idx_usage_records_user_period on usage_records(user_id, period);
create index idx_usage_records_user_action on usage_records(user_id, action);
```

### RLS Policies

All three new tables:

```sql
-- subscription_plans: readable by all authenticated users
alter table subscription_plans enable row level security;
create policy "Authenticated can read plans" on subscription_plans for select using (auth.role() = 'authenticated');

-- user_subscriptions: users read own, service role manages
alter table user_subscriptions enable row level security;
create policy "Users can read own subscription" on user_subscriptions for select using (auth.uid() = user_id);
create policy "Service role full access" on user_subscriptions for all using (auth.role() = 'service_role');

-- usage_records: users read own, service role manages
alter table usage_records enable row level security;
create policy "Users can read own usage" on usage_records for select using (auth.uid() = user_id);
create policy "Service role full access" on usage_records for all using (auth.role() = 'service_role');
```

## Types

```typescript
// packages/db/src/enums.ts
export enum SubscriptionStatus {
  Active = 'active',
  Cancelled = 'cancelled',
  PastDue = 'past_due',
}

export enum UsageAction {
  Score = 'score',
  Scrape = 'scrape',
  ScrapeLarge = 'scrape_large',
  AttioSync = 'attio_sync',
  LeadOverage = 'lead_overage',
}

// packages/db/src/types.ts
export interface SubscriptionPlan {
  id: string
  name: string
  base_price_cents: number
  max_leads: number | null
  max_scores_per_month: number | null
  max_scores_lifetime: number | null
  max_scrapes_per_month: number | null
  max_scrapes_lifetime: number | null
  max_scrape_leads_lifetime: number | null
  attio_sync_enabled: boolean
  cost_per_score_cents: number
  cost_per_scrape_cents: number
  cost_per_scrape_large_cents: number
  cost_per_lead_overage_cents: number
  cost_per_attio_sync_cents: number
  created_at: string
}

export interface UserSubscription {
  id: string
  user_id: string
  plan_id: string
  status: SubscriptionStatus
  started_at: string
  expires_at: string | null
  created_at: string
}

export interface UsageRecord {
  id: string
  user_id: string
  action: UsageAction
  quantity: number
  cost_cents: number
  period: string
  metadata: Record<string, unknown> | null
  created_at: string
}
```

## Feature Gating Logic

New file: `apps/dashboard/src/lib/limits.ts`

```typescript
interface LimitCheckResult {
  allowed: boolean
  reason?: string
  cost_cents?: number  // for per_use tier, how much this action will cost
}

async function checkLimit(userId: string, action: UsageAction): Promise<LimitCheckResult>
```

**Logic:**

1. Fetch profile — if `is_admin`, return `{ allowed: true }` immediately
2. Fetch user's subscription + plan
3. If no subscription, treat as free tier
4. Based on action and plan, check:
   - **Score:** free = lifetime < 1, pro = monthly < 100, enterprise = allowed, per_use = allowed (return cost)
   - **Scrape:** free = lifetime scrapes < 5 AND lifetime scrape leads < 100, pro = monthly < 100, enterprise = allowed, per_use = allowed (return cost based on lead count)
   - **Attio sync:** free = blocked, per_use = allowed (return cost $1.00), pro/enterprise = allowed
5. Return `{ allowed, reason, cost_cents }`

**Usage tracking:**

```typescript
async function recordUsage(userId: string, action: UsageAction, costCents: number, metadata?: Record<string, unknown>): Promise<void>
```

Inserts a `usage_records` row with the current period (`YYYY-MM`).

## Integration Points

### On sign-up (auth callback)
After creating the profile, also create a `user_subscriptions` row with `plan_id = 'free'`.

### Score Leads button
Before scoring: `checkLimit(userId, 'score')`. If blocked, show upgrade message. After scoring each lead, `recordUsage()`.

### Scraper
Before scraping: `checkLimit(userId, 'scrape')`. If blocked, show upgrade message. After scrape completes, `recordUsage()`.

### Attio Sync button
Before syncing: `checkLimit(userId, 'attio_sync')`. If blocked, show "Attio sync not available on Free plan" message. After sync, `recordUsage()`.

### UI enforcement
Buttons that are blocked show:
- Disabled state
- Tooltip or inline text: "Upgrade to [next tier] to unlock this feature"
- Link to contact admin (for now, since no self-serve billing)

## New Files

| File | Responsibility |
|---|---|
| `supabase/migrations/003_add_subscriptions.sql` | Tables, enums, seed data, RLS, profiles is_admin column |
| `packages/db/src/types.ts` | Add SubscriptionPlan, UserSubscription, UsageRecord interfaces |
| `packages/db/src/enums.ts` | Add SubscriptionStatus, UsageAction enums |
| `packages/db/src/queries.ts` | Add subscription + usage query functions |
| `apps/dashboard/src/lib/limits.ts` | checkLimit() and recordUsage() functions |

## Modified Files

| File | Change |
|---|---|
| `apps/dashboard/src/app/auth/callback/route.ts` | Create free subscription on sign-up |
| `apps/dashboard/src/app/leads/actions.ts` | Add limit checks to scoreLeadsAction |
| `apps/scraper-service/src/index.ts` | Add limit checks to scoring/scraping endpoints |
| Score/scrape/attio button components | Disabled state + upgrade message when limit hit |

## What doesn't change

- All data tables (leads, clients, etc.) — no user_id added yet
- Admin users see and do everything as before
- No Stripe or payment processing
- No self-serve upgrade flow
- Existing features work identically for admins
