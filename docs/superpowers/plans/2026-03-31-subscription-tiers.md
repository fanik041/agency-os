# Subscription Tiers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a 4-tier subscription system (Free, Per Use, Pro, Enterprise) with usage tracking, feature gating, and admin bypass. Admin-managed tiers, no Stripe.

**Architecture:** New Supabase tables (`subscription_plans`, `user_subscriptions`, `usage_records`) store tier definitions, user assignments, and metered usage. A server-side `limits.ts` module checks permissions before every gated action and records usage after. UI buttons show disabled state with upgrade prompts when limits are hit. Admin users (`profiles.is_admin = true`) bypass all checks.

**Tech Stack:** Supabase (PostgreSQL), TypeScript enums, Next.js server actions.

**Spec:** `docs/superpowers/specs/2026-03-31-subscription-tiers-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `supabase/migrations/003_add_subscriptions.sql` | Tables, enums, seed data, RLS, profiles.is_admin column |
| `apps/dashboard/src/lib/limits.ts` | `checkLimit()` and `recordUsage()` — all gating logic |

### Modified Files
| File | Change |
|---|---|
| `packages/db/src/enums.ts` | Add `SubscriptionStatus`, `UsageAction`, `PlanId` enums |
| `packages/db/src/types.ts` | Add `SubscriptionPlan`, `UserSubscription`, `UsageRecord` interfaces + `is_admin` to Profile + Database entries |
| `packages/db/src/queries.ts` | Add subscription + usage query functions |
| `apps/dashboard/src/app/auth/callback/route.ts` | Create free subscription on sign-up |
| `apps/dashboard/src/components/leads/score-leads-button.tsx` | Add limit check + upgrade prompt |
| `apps/dashboard/src/components/leads/update-attio-button.tsx` | Add limit check + upgrade prompt |

---

### Task 1: Add enums

**Files:**
- Modify: `packages/db/src/enums.ts`

- [ ] **Step 1: Add the three new enums at the end of the file**

```typescript
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

export enum PlanId {
  Free = 'free',
  PerUse = 'per_use',
  Pro = 'pro',
  Enterprise = 'enterprise',
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/enums.ts
git commit -m "feat(subscriptions): add SubscriptionStatus, UsageAction, PlanId enums"
```

---

### Task 2: Add types

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Add is_admin to Profile interface**

In `packages/db/src/types.ts`, find the `Profile` interface (line ~162) and add `is_admin`:

```typescript
export interface Profile {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  is_admin: boolean
  created_at: string
}
```

- [ ] **Step 2: Add the three new interfaces after Profile (before Database)**

```typescript
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

- [ ] **Step 3: Add to Database interface**

Inside `Database.public.Tables`, add after the `profiles` entry:

```typescript
      subscription_plans: {
        Row: SubscriptionPlan
        Insert: Omit<SubscriptionPlan, 'created_at'>
        Update: Partial<Omit<SubscriptionPlan, 'id' | 'created_at'>>
      }
      user_subscriptions: {
        Row: UserSubscription
        Insert: Omit<UserSubscription, 'id' | 'created_at'>
        Update: Partial<Omit<UserSubscription, 'id' | 'created_at'>>
      }
      usage_records: {
        Row: UsageRecord
        Insert: Omit<UsageRecord, 'id' | 'created_at'>
        Update: Partial<Omit<UsageRecord, 'id' | 'created_at'>>
      }
```

- [ ] **Step 4: Add imports for new enums at the top of types.ts**

Add `SubscriptionStatus` and `UsageAction` to the import from `./enums`:

```typescript
import type {
  LeadStatus,
  AttioSyncStatus,
  // ...existing imports...
  SubscriptionStatus,
  UsageAction,
} from './enums'
```

And add them to the re-export block:

```typescript
export type {
  LeadStatus,
  AttioSyncStatus,
  // ...existing re-exports...
  SubscriptionStatus,
  UsageAction,
}
```

- [ ] **Step 5: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "feat(subscriptions): add SubscriptionPlan, UserSubscription, UsageRecord types + is_admin to Profile"
```

---

### Task 3: Add query functions

**Files:**
- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Add subscription and usage query functions at the end of the file**

```typescript
// SUBSCRIPTIONS

export async function getSubscriptionPlan(planId: string) {
  return supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .eq('id', planId)
    .single()
}

export async function getAllSubscriptionPlans() {
  return supabaseAdmin
    .from('subscription_plans')
    .select('*')
    .order('base_price_cents', { ascending: true })
}

export async function getUserSubscription(userId: string) {
  return supabaseAdmin
    .from('user_subscriptions')
    .select('*, subscription_plans(*)')
    .eq('user_id', userId)
    .maybeSingle()
}

export async function createUserSubscription(userId: string, planId: string) {
  return supabaseAdmin
    .from('user_subscriptions')
    .insert({
      user_id: userId,
      plan_id: planId,
      status: 'active' as const,
      started_at: new Date().toISOString(),
    })
    .select()
    .single()
}

export async function updateUserSubscriptionPlan(userId: string, planId: string) {
  return supabaseAdmin
    .from('user_subscriptions')
    .update({ plan_id: planId })
    .eq('user_id', userId)
    .select()
    .single()
}

// USAGE TRACKING

export async function getUsageForPeriod(userId: string, period: string) {
  return supabaseAdmin
    .from('usage_records')
    .select('*')
    .eq('user_id', userId)
    .eq('period', period)
}

export async function getUsageCountByAction(userId: string, action: string, period: string) {
  return supabaseAdmin
    .from('usage_records')
    .select('quantity')
    .eq('user_id', userId)
    .eq('action', action)
    .eq('period', period)
}

export async function getLifetimeUsageCount(userId: string, action: string) {
  return supabaseAdmin
    .from('usage_records')
    .select('quantity')
    .eq('user_id', userId)
    .eq('action', action)
}

export async function insertUsageRecord(record: {
  user_id: string
  action: string
  quantity: number
  cost_cents: number
  period: string
  metadata?: Record<string, unknown> | null
}) {
  return supabaseAdmin
    .from('usage_records')
    .insert(record)
    .select()
    .single()
}
```

- [ ] **Step 2: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(subscriptions): add subscription and usage query functions"
```

---

### Task 4: Create migration SQL

**Files:**
- Create: `supabase/migrations/003_add_subscriptions.sql`

- [ ] **Step 1: Create the migration file**

```sql
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
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/003_add_subscriptions.sql
git commit -m "feat(subscriptions): add migration for plans, subscriptions, usage tables + admin flag"
```

---

### Task 5: Create limits module

**Files:**
- Create: `apps/dashboard/src/lib/limits.ts`

- [ ] **Step 1: Create the limits module**

```typescript
import {
  getProfileById,
  getUserSubscription,
  getUsageCountByAction,
  getLifetimeUsageCount,
  insertUsageRecord,
} from '@agency-os/db'
import { UsageAction, PlanId } from '@agency-os/db'

export interface LimitCheckResult {
  allowed: boolean
  reason?: string
  cost_cents?: number
}

function currentPeriod(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

async function getMonthlyUsageTotal(userId: string, action: UsageAction): Promise<number> {
  const { data } = await getUsageCountByAction(userId, action, currentPeriod())
  if (!data) return 0
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
}

async function getLifetimeUsageTotal(userId: string, action: UsageAction): Promise<number> {
  const { data } = await getLifetimeUsageCount(userId, action)
  if (!data) return 0
  return data.reduce((sum, row) => sum + (row.quantity ?? 0), 0)
}

export async function checkLimit(userId: string, action: UsageAction): Promise<LimitCheckResult> {
  // Admin bypass
  const { data: profile } = await getProfileById(userId)
  if (profile?.is_admin) {
    return { allowed: true }
  }

  // Get subscription + plan
  const { data: subscription } = await getUserSubscription(userId)
  const plan = subscription?.subscription_plans as {
    id: string
    max_scores_per_month: number | null
    max_scores_lifetime: number | null
    max_scrapes_per_month: number | null
    max_scrapes_lifetime: number | null
    max_scrape_leads_lifetime: number | null
    attio_sync_enabled: boolean
    cost_per_score_cents: number
    cost_per_scrape_cents: number
    cost_per_scrape_large_cents: number
    cost_per_attio_sync_cents: number
  } | null

  // No subscription = free tier
  const planId = subscription?.plan_id ?? PlanId.Free

  if (!plan && planId !== PlanId.Free) {
    return { allowed: false, reason: 'Subscription plan not found' }
  }

  switch (action) {
    case UsageAction.Score: {
      if (planId === PlanId.Free) {
        const lifetime = await getLifetimeUsageTotal(userId, UsageAction.Score)
        if (lifetime >= 1) {
          return { allowed: false, reason: 'Free plan allows 1 score. Upgrade to continue scoring.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_score_cents ?? 10 }
      }
      if (planId === PlanId.Pro) {
        const monthly = await getMonthlyUsageTotal(userId, UsageAction.Score)
        if (monthly >= (plan?.max_scores_per_month ?? 100)) {
          return { allowed: false, reason: 'Pro plan limit reached (100 scores/month). Upgrade to Enterprise.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      // Enterprise
      return { allowed: true, cost_cents: 0 }
    }

    case UsageAction.Scrape: {
      if (planId === PlanId.Free) {
        const lifetimeScrapes = await getLifetimeUsageTotal(userId, UsageAction.Scrape)
        if (lifetimeScrapes >= 5) {
          return { allowed: false, reason: 'Free plan allows 5 scrape jobs. Upgrade to continue.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_scrape_cents ?? 50 }
      }
      if (planId === PlanId.Pro) {
        const monthly = await getMonthlyUsageTotal(userId, UsageAction.Scrape)
        if (monthly >= (plan?.max_scrapes_per_month ?? 100)) {
          return { allowed: false, reason: 'Pro plan limit reached (100 scrapes/month). Upgrade to Enterprise.' }
        }
        return { allowed: true, cost_cents: 0 }
      }
      return { allowed: true, cost_cents: 0 }
    }

    case UsageAction.ScrapeLarge: {
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_scrape_large_cents ?? 100 }
      }
      // Same limits as regular scrape for other tiers
      return checkLimit(userId, UsageAction.Scrape)
    }

    case UsageAction.AttioSync: {
      if (planId === PlanId.Free) {
        return { allowed: false, reason: 'Attio sync is not available on the Free plan. Upgrade to Per Use or higher.' }
      }
      if (planId === PlanId.PerUse) {
        return { allowed: true, cost_cents: plan?.cost_per_attio_sync_cents ?? 100 }
      }
      return { allowed: true, cost_cents: 0 }
    }

    default:
      return { allowed: true, cost_cents: 0 }
  }
}

export async function recordUsage(
  userId: string,
  action: UsageAction,
  costCents: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  // Admin bypass — don't track admin usage
  const { data: profile } = await getProfileById(userId)
  if (profile?.is_admin) return

  await insertUsageRecord({
    user_id: userId,
    action,
    quantity: 1,
    cost_cents: costCents,
    period: currentPeriod(),
    metadata: metadata ?? null,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/limits.ts
git commit -m "feat(subscriptions): add limits module with checkLimit and recordUsage"
```

---

### Task 6: Update auth callback to create free subscription

**Files:**
- Modify: `apps/dashboard/src/app/auth/callback/route.ts`

- [ ] **Step 1: Add import and subscription creation**

Add to the imports at the top of the file:

```typescript
import { upsertProfile, getProfileById, createUserSubscription } from '@agency-os/db'
```

Then find the block where a new profile is created (the `if (!existingProfile)` block with `allowSignups` check). After the `upsertProfile()` call for new users, add:

```typescript
    // Create free subscription for new user
    await createUserSubscription(user.id, 'free')
```

The block should look like:

```typescript
    await upsertProfile({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.user_metadata?.name ?? null,
      avatar_url: user.user_metadata?.avatar_url ?? user.user_metadata?.picture ?? null,
    })

    // Create free subscription for new user
    await createUserSubscription(user.id, 'free')
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/auth/callback/route.ts
git commit -m "feat(subscriptions): auto-create free subscription on sign-up"
```

---

### Task 7: Add limit checks to ScoreLeadsButton

**Files:**
- Modify: `apps/dashboard/src/components/leads/score-leads-button.tsx`

- [ ] **Step 1: Add limit check before scoring starts**

This task requires the button to check limits before connecting to the SSE stream. Since `checkLimit` is a server-side function and the button is a client component, we need a server action.

Add a new server action in `apps/dashboard/src/app/leads/actions.ts`. Read the file first, then add at the end:

```typescript
export async function checkScoringLimitAction() {
  const user = await requireAuth()
  const { checkLimit } = await import('@/lib/limits')
  const { UsageAction } = await import('@agency-os/db')
  return checkLimit(user.id, UsageAction.Score)
}
```

Then in `apps/dashboard/src/components/leads/score-leads-button.tsx`, add the import at the top:

```typescript
import { checkScoringLimitAction } from '@/app/leads/actions'
```

Then in the `handleScore` function, add a limit check before the SSE connection. Find `addLog('Connecting to scoring pipeline...')` and add before it:

```typescript
    // Check tier limits
    const limitResult = await checkScoringLimitAction()
    if (!limitResult.allowed) {
      addLog(`Blocked: ${limitResult.reason}`, 'error')
      setLoading(false)
      startedRef.current = false
      return
    }
    if (limitResult.cost_cents && limitResult.cost_cents > 0) {
      addLog(`Cost: $${(limitResult.cost_cents / 100).toFixed(2)} per lead scored (Per Use plan)`)
    }
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/leads/actions.ts apps/dashboard/src/components/leads/score-leads-button.tsx
git commit -m "feat(subscriptions): add scoring limit check to ScoreLeadsButton"
```

---

### Task 8: Add limit checks to SyncAttioButton

**Files:**
- Modify: `apps/dashboard/src/components/leads/update-attio-button.tsx`
- Modify: `apps/dashboard/src/app/leads/actions.ts`

- [ ] **Step 1: Add server action for Attio limit check**

In `apps/dashboard/src/app/leads/actions.ts`, add:

```typescript
export async function checkAttioSyncLimitAction() {
  const user = await requireAuth()
  const { checkLimit } = await import('@/lib/limits')
  const { UsageAction } = await import('@agency-os/db')
  return checkLimit(user.id, UsageAction.AttioSync)
}
```

- [ ] **Step 2: Add limit check in SyncAttioButton**

In `apps/dashboard/src/components/leads/update-attio-button.tsx`, add the import:

```typescript
import { compareAttioAction, updateSingleAttioEntryAction, createNewAttioEntryAction, checkAttioSyncLimitAction } from '@/app/leads/actions'
```

Then in the `handleSync` function, add a limit check at the very beginning after `setOpen(true)`:

```typescript
    // Check tier limits
    const limitResult = await checkAttioSyncLimitAction()
    if (!limitResult.allowed) {
      addLog(`Blocked: ${limitResult.reason}`, 'error')
      setLoading(false)
      return
    }
    if (limitResult.cost_cents && limitResult.cost_cents > 0) {
      addLog(`Cost: $${(limitResult.cost_cents / 100).toFixed(2)} per sync (Per Use plan)`)
    }
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/leads/actions.ts apps/dashboard/src/components/leads/update-attio-button.tsx
git commit -m "feat(subscriptions): add Attio sync limit check to SyncAttioButton"
```

---

### Task 9: Verify build

- [ ] **Step 1: Type-check the db package**

```bash
cd packages/db && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Build the dashboard**

```bash
cd apps/dashboard && npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Run the migration**

Copy `supabase/migrations/003_add_subscriptions.sql` and run it in Supabase Dashboard → SQL Editor.

- [ ] **Step 4: Fix any build issues and commit**

```bash
git add -A
git commit -m "fix(subscriptions): address build issues from tier implementation"
```
