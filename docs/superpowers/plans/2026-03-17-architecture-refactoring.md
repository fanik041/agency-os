# Architecture Refactoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the flat server-actions architecture into a layered Controller → Service → Repository → API Client architecture with enums, Zod validation, auth guards, and elimination of `any` types.

**Architecture:** Six migration phases executed sequentially — Foundation (enums/schemas), Repositories, Attio API Client package, Services, Controller refactoring, Cleanup. Each phase produces working software that passes `pnpm build` before proceeding.

**Tech Stack:** TypeScript, Next.js (server actions), Supabase JS, Zod, pnpm monorepo with Turbo

**Spec:** `docs/superpowers/specs/2026-03-17-architecture-refactoring-design.md`

---

## Chunk 1: Foundation (Enums, Schemas, Types)

### Task 1: Add Zod dependency to `@agency-os/db`

**Files:**
- Modify: `packages/db/package.json`

- [ ] **Step 1: Add zod to dependencies**

```bash
cd /Users/fahimanik/code/agency-os && pnpm add zod --filter @agency-os/db
```

- [ ] **Step 2: Verify install**

```bash
pnpm ls zod --filter @agency-os/db
```
Expected: `zod 3.x.x`

- [ ] **Step 3: Commit**

```bash
git add packages/db/package.json pnpm-lock.yaml
git commit -m "chore: add zod dependency to @agency-os/db"
```

---

### Task 2: Create runtime enums

**Files:**
- Create: `packages/db/src/enums.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create `enums.ts`**

```typescript
// packages/db/src/enums.ts
export enum LeadStatus {
  New = 'new',
  Scoring = 'scoring',
  NeedsReview = 'needs_review',
  Approved = 'approved',
  Sent = 'sent',
  Replied = 'replied',
  Booked = 'booked',
  Closed = 'closed',
  Skip = 'skip',
}

export enum AttioSyncStatus {
  NotSynced = 'not_synced',
  Synced = 'synced',
  Failed = 'failed',
}

export enum ScrapeJobStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}

export enum CallOutcome {
  NoAnswer = 'no_answer',
  Voicemail = 'voicemail',
  NotInterested = 'not_interested',
  CallbackRequested = 'callback_requested',
  DemoBooked = 'demo_booked',
  Closed = 'closed',
}

export enum RevenueType {
  Deposit = 'deposit',
  Final = 'final',
  Retainer = 'retainer',
}

export enum SiteStatus {
  Building = 'building',
  Live = 'live',
  Paused = 'paused',
}

export enum ContactSource {
  GoogleLinkedin = 'google_linkedin',
  WebsiteAbout = 'website_about',
  WebsiteContact = 'website_contact',
  Manual = 'manual',
}

export enum LeadSourceType {
  Scrape = 'scrape',
  Import = 'import',
  Manual = 'manual',
}

export enum ResearchJobStatus {
  Queued = 'queued',
  Running = 'running',
  Done = 'done',
  Failed = 'failed',
}
```

- [ ] **Step 2: Add export to `index.ts`**

Add to `packages/db/src/index.ts`:
```typescript
export * from './enums'
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter @agency-os/db typecheck
```
Expected: PASS (no errors)

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/enums.ts packages/db/src/index.ts
git commit -m "feat: add runtime enums for all domain types"
```

---

### Task 3: Create Zod schemas

**Files:**
- Create: `packages/db/src/schemas.ts`
- Modify: `packages/db/src/index.ts`

- [ ] **Step 1: Create `schemas.ts`**

```typescript
// packages/db/src/schemas.ts
import { z } from 'zod'
import {
  LeadStatus, CallOutcome, ScrapeJobStatus,
  RevenueType, SiteStatus, ContactSource,
} from './enums'

// ── Leads ──
export const updateLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.nativeEnum(LeadStatus),
  notes: z.string().max(5000).optional(),
})

export const logCallSchema = z.object({
  leadId: z.string().uuid(),
  outcome: z.nativeEnum(CallOutcome),
  notes: z.string().max(5000),
  durationSeconds: z.number().int().nullable(),
})

export const importLeadsSchema = z.object({
  leads: z.array(z.object({
    name: z.string().min(1).max(500),
    niche: z.string().max(200).nullable(),
    phone: z.string().max(50).nullable(),
    email: z.string().email().nullable().or(z.literal(null)),
    website: z.string().max(2000).nullable(),
    pain_score: z.number().int().min(0).max(100).nullable(),
    city: z.string().max(200).nullable(),
  })).min(1).max(10000),
  fileName: z.string().max(500).optional(),
})

// ── Attio Sync ──
export const updateSingleAttioEntrySchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  recordId: z.string().min(1),
  entryValues: z.record(z.unknown()),
  changedFields: z.array(z.string()),
})

// ── Scraper ──
export const triggerScrapeSchema = z.object({
  niches: z.array(z.string().min(1)).min(1),
  location: z.string().min(1),
  maxPerNiche: z.number().int().min(1).max(100),
  withEmails: z.boolean(),
})

// ── Clients ──
export const createClientSchema = z.object({
  lead_id: z.string().uuid().nullable(),
  business_name: z.string().min(1).max(500),
  contact_name: z.string().max(500).nullable(),
  phone: z.string().max(50).nullable(),
  email: z.string().email().nullable().or(z.literal(null)),
  niche: z.string().max(200).nullable(),
  city: z.string().max(200).nullable(),
  deal_value: z.number().nullable(),
})

export const updateClientSchema = z.object({
  id: z.string().uuid(),
  business_name: z.string().min(1).max(500),
  contact_name: z.string().max(500).nullable(),
  phone: z.string().max(50).nullable(),
  email: z.string().email().nullable().or(z.literal(null)),
  niche: z.string().max(200).nullable(),
  city: z.string().max(200).nullable(),
  site_url: z.string().max(2000).nullable(),
  deal_value: z.number().nullable(),
  paid_upfront: z.number().default(0),
  paid_final: z.number().default(0),
  retainer_amount: z.number().default(0),
  retainer_active: z.boolean().default(false),
  retainer_billing_day: z.number().int().min(1).max(31).nullable(),
  site_status: z.nativeEnum(SiteStatus).default(SiteStatus.Building),
})

// ── Contacts ──
export const triggerResearchSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
})

export const updateContactTagsSchema = z.object({
  contactId: z.string().uuid(),
  tags: z.array(z.string().max(100)),
})

export const updateContactNotesSchema = z.object({
  contactId: z.string().uuid(),
  notes: z.string().max(10000),
})

export const linkContactToLeadSchema = z.object({
  contactId: z.string().uuid(),
  leadId: z.string().uuid().nullable(),
})

// ── Revenue ──
export const addRevenueEventSchema = z.object({
  client_id: z.string().uuid(),
  type: z.nativeEnum(RevenueType),
  amount: z.number().positive(),
  date: z.string().min(1),
  notes: z.string().max(5000).nullable(),
})

// ── Scraper Job Status ──
export const updateJobStatusSchema = z.object({
  jobId: z.string().uuid(),
  status: z.enum(['done', 'failed']),
})
```

- [ ] **Step 2: Add export to `index.ts`**

Add to `packages/db/src/index.ts`:
```typescript
export * from './schemas'
```

- [ ] **Step 3: Verify typecheck**

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter @agency-os/db typecheck
```
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/schemas.ts packages/db/src/index.ts
git commit -m "feat: add Zod validation schemas for all server actions"
```

---

### Task 4: Update `types.ts` to use enums

**Files:**
- Modify: `packages/db/src/types.ts`

- [ ] **Step 1: Add enum imports and update type aliases**

At the top of `packages/db/src/types.ts`, replace the string literal type declarations with re-exports from enums. Keep the old type aliases as re-exports for backward compatibility:

```typescript
// packages/db/src/types.ts — top of file
import {
  LeadStatus as LeadStatusEnum,
  AttioSyncStatus as AttioSyncStatusEnum,
  ScrapeJobStatus as ScrapeJobStatusEnum,
  CallOutcome as CallOutcomeEnum,
  RevenueType as RevenueTypeEnum,
  SiteStatus as SiteStatusEnum,
  ContactSource as ContactSourceEnum,
  LeadSourceType as LeadSourceTypeEnum,
  ResearchJobStatus as ResearchJobStatusEnum,
} from './enums'

// Re-export enum types as the old type aliases for backward compat
export type LeadStatus = LeadStatusEnum
export type AttioSyncStatus = AttioSyncStatusEnum
export type CallStatus = LeadStatusEnum
export type SiteStatus = SiteStatusEnum
export type ScrapeJobStatus = ScrapeJobStatusEnum
export type CallOutcome = CallOutcomeEnum
export type RevenueType = RevenueTypeEnum
export type ResearchJobStatus = ResearchJobStatusEnum
export type ContactSource = ContactSourceEnum
export type LeadSourceType = LeadSourceTypeEnum
```

Remove the old string literal union declarations (the first ~17 lines). Keep all interfaces unchanged — they already reference these type names.

- [ ] **Step 2: Verify typecheck of db package**

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter @agency-os/db typecheck
```
Expected: PASS

- [ ] **Step 3: Verify full build**

```bash
cd /Users/fahimanik/code/agency-os && pnpm build
```
Expected: All packages build successfully. The enum values match the existing string literals exactly, so all downstream consumers should compile without changes.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/types.ts
git commit -m "refactor: update type aliases to re-export from enums"
```

---

## Chunk 2: Repository Layer

### Task 5: Create LeadRepository

**Files:**
- Create: `packages/db/src/repositories/lead-repository.ts`

- [ ] **Step 1: Create the repository**

```typescript
// packages/db/src/repositories/lead-repository.ts
import { supabaseAdmin } from '../client'
import type { Lead, LeadSource } from '../types'
import type { LeadStatus, AttioSyncStatus } from '../enums'

export class LeadRepository {
  async getAll(): Promise<Lead[]> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return data as Lead[]
  }

  async getById(id: string): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(`Lead not found: ${error.message}`)
    return data as Lead
  }

  async getPaginated(filters: {
    city?: string
    niche?: string
    status?: LeadStatus
    minPainScore?: number
    q?: string
    sourceId?: string
    page: number
    perPage: number
  }): Promise<{ data: Lead[]; count: number }> {
    const from = (filters.page - 1) * filters.perPage
    const to = from + filters.perPage - 1

    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('pain_score', { ascending: false, nullsFirst: false })

    if (filters.city) query = query.eq('city', filters.city)
    if (filters.niche) query = query.eq('niche', filters.niche)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.minPainScore) query = query.gte('pain_score', filters.minPainScore)
    if (filters.q) query = query.ilike('name', `%${filters.q}%`)
    if (filters.sourceId) query = query.eq('source_id', filters.sourceId)

    query = query.range(from, to)
    const { data, count, error } = await query
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return { data: (data ?? []) as Lead[], count: count ?? 0 }
  }

  async getCount(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
    if (error) throw new Error(`Failed to count leads: ${error.message}`)
    return count ?? 0
  }

  async getMinimal(): Promise<{ id: string; name: string; niche: string | null; city: string | null }[]> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, niche, city')
      .order('name', { ascending: true })
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return data as { id: string; name: string; niche: string | null; city: string | null }[]
  }

  async updateStatus(id: string, status: LeadStatus, notes?: string): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ status, notes })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update lead status: ${error.message}`)
    return data as Lead
  }

  async updateAttioSync(id: string, syncStatus: AttioSyncStatus): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({
        attio_sync_status: syncStatus,
        attio_synced_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update sync status: ${error.message}`)
    return data as Lead
  }

  async upsert(lead: Omit<Lead, 'id' | 'created_at'> & { id?: string }): Promise<Lead> {
    if (lead.maps_url) {
      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('maps_url', lead.maps_url)
        .maybeSingle()
      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('leads')
          .update(lead)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw new Error(`Failed to update lead: ${error.message}`)
        return data as Lead
      }
    }
    const { data, error } = await supabaseAdmin.from('leads').insert(lead).select().single()
    if (error) throw new Error(`Failed to insert lead: ${error.message}`)
    return data as Lead
  }

  async bulkUpsert(leads: Omit<Lead, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
    const results = { inserted: 0, updated: 0, errors: [] as string[] }
    for (const lead of leads) {
      try {
        await this.upsert({ ...lead, status: lead.status || ('new' as LeadStatus), notes: lead.notes || null })
        results.inserted++
      } catch (err) {
        results.errors.push(`${lead.name}: ${err}`)
      }
    }
    return results
  }

  async getFilterOptions(): Promise<{ niches: string[]; cities: string[]; sources: LeadSource[] }> {
    const [nichesRes, citiesRes, sourcesRes] = await Promise.all([
      supabaseAdmin.from('leads').select('niche').not('niche', 'is', null),
      supabaseAdmin.from('leads').select('city').not('city', 'is', null),
      supabaseAdmin.from('lead_sources').select('*').order('created_at', { ascending: false }),
    ])
    const niches = [...new Set((nichesRes.data ?? []).map((r) => r.niche as string))]
    const cities = [...new Set((citiesRes.data ?? []).map((r) => r.city as string))]
    const sources = (sourcesRes.data ?? []) as LeadSource[]
    return { niches, cities, sources }
  }
}
```

- [ ] **Step 2: Verify typecheck**

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter @agency-os/db typecheck
```

- [ ] **Step 3: Commit**

```bash
git add packages/db/src/repositories/lead-repository.ts
git commit -m "feat: add LeadRepository with all query methods"
```

---

### Task 6: Create remaining repositories

**Files:**
- Create: `packages/db/src/repositories/client-repository.ts`
- Create: `packages/db/src/repositories/scrape-job-repository.ts`
- Create: `packages/db/src/repositories/call-log-repository.ts`
- Create: `packages/db/src/repositories/contact-repository.ts`
- Create: `packages/db/src/repositories/research-job-repository.ts`
- Create: `packages/db/src/repositories/lead-source-repository.ts`
- Create: `packages/db/src/repositories/revenue-event-repository.ts`
- Create: `packages/db/src/repositories/index.ts`

- [ ] **Step 1: Create `client-repository.ts`**

```typescript
// packages/db/src/repositories/client-repository.ts
import { supabaseAdmin } from '../client'
import type { Client } from '../types'

export class ClientRepository {
  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*, leads(name, niche, city)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch clients: ${error.message}`)
    return data
  }

  async getById(id: string) {
    const { data, error } = await supabaseAdmin
      .from('clients')
      .select('*, leads(name, niche, city)')
      .eq('id', id)
      .single()
    if (error) throw new Error(`Client not found: ${error.message}`)
    return data
  }

  async create(client: Omit<Client, 'id' | 'created_at'>): Promise<Client> {
    const { data, error } = await supabaseAdmin.from('clients').insert(client).select().single()
    if (error) throw new Error(`Failed to create client: ${error.message}`)
    return data as Client
  }

  async update(id: string, updates: Partial<Omit<Client, 'id' | 'created_at'>>): Promise<Client> {
    const { data, error } = await supabaseAdmin.from('clients').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update client: ${error.message}`)
    return data as Client
  }
}
```

- [ ] **Step 2: Create `scrape-job-repository.ts`**

```typescript
// packages/db/src/repositories/scrape-job-repository.ts
import { supabaseAdmin } from '../client'
import type { ScrapeJob } from '../types'

export class ScrapeJobRepository {
  async getAll(): Promise<ScrapeJob[]> {
    const { data, error } = await supabaseAdmin
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`Failed to fetch scrape jobs: ${error.message}`)
    return data as ScrapeJob[]
  }

  async create(job: Pick<ScrapeJob, 'niches' | 'location' | 'city' | 'max_per_niche' | 'with_emails'>): Promise<ScrapeJob> {
    const { data, error } = await supabaseAdmin
      .from('scrape_jobs')
      .insert({ ...job, status: 'queued' as const, leads_found: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create scrape job: ${error.message}`)
    return data as ScrapeJob
  }

  async update(id: string, updates: Partial<Omit<ScrapeJob, 'id' | 'created_at'>>): Promise<ScrapeJob> {
    const { data, error } = await supabaseAdmin.from('scrape_jobs').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update scrape job: ${error.message}`)
    return data as ScrapeJob
  }
}
```

- [ ] **Step 3: Create `call-log-repository.ts`**

```typescript
// packages/db/src/repositories/call-log-repository.ts
import { supabaseAdmin } from '../client'
import type { CallLog } from '../types'

export class CallLogRepository {
  async log(entry: Omit<CallLog, 'id' | 'called_at'>): Promise<CallLog> {
    const { data, error } = await supabaseAdmin.from('call_log').insert(entry).select().single()
    if (error) throw new Error(`Failed to log call: ${error.message}`)
    return data as CallLog
  }

  async getForLead(leadId: string): Promise<CallLog[]> {
    const { data, error } = await supabaseAdmin
      .from('call_log')
      .select('*')
      .eq('lead_id', leadId)
      .order('called_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch call log: ${error.message}`)
    return data as CallLog[]
  }
}
```

- [ ] **Step 4: Create `contact-repository.ts`**

```typescript
// packages/db/src/repositories/contact-repository.ts
import { supabaseAdmin } from '../client'
import type { Contact } from '../types'

export class ContactRepository {
  async getAll() {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*, leads(name, niche, city)')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
    return data
  }

  async getForLead(leadId: string): Promise<Contact[]> {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .select('*')
      .eq('lead_id', leadId)
      .order('confidence', { ascending: false })
    if (error) throw new Error(`Failed to fetch contacts: ${error.message}`)
    return data as Contact[]
  }

  async upsert(contact: Omit<Contact, 'id' | 'created_at'>): Promise<Contact> {
    const row = { ...contact, tags: contact.tags?.length ? contact.tags : [] }
    const { data, error } = await supabaseAdmin.from('contacts').insert(row).select().single()
    if (error) throw new Error(`Failed to upsert contact: ${error.message}`)
    return data as Contact
  }

  async update(id: string, updates: Partial<Omit<Contact, 'id' | 'created_at'>>): Promise<Contact> {
    const { data, error } = await supabaseAdmin.from('contacts').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update contact: ${error.message}`)
    return data as Contact
  }

  async updateTags(id: string, tags: string[]): Promise<Contact> {
    const { data, error } = await supabaseAdmin.from('contacts').update({ tags }).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update tags: ${error.message}`)
    return data as Contact
  }

  async linkToLead(contactId: string, leadId: string | null) {
    const { data, error } = await supabaseAdmin
      .from('contacts')
      .update({ lead_id: leadId })
      .eq('id', contactId)
      .select('*, leads(name, niche, city)')
      .single()
    if (error) throw new Error(`Failed to link contact: ${error.message}`)
    return data
  }
}
```

- [ ] **Step 5: Create `research-job-repository.ts`**

```typescript
// packages/db/src/repositories/research-job-repository.ts
import { supabaseAdmin } from '../client'
import type { ResearchJob } from '../types'

export class ResearchJobRepository {
  async getAll(): Promise<ResearchJob[]> {
    const { data, error } = await supabaseAdmin
      .from('research_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`Failed to fetch research jobs: ${error.message}`)
    return data as ResearchJob[]
  }

  async create(leadIds: string[]): Promise<ResearchJob> {
    const { data, error } = await supabaseAdmin
      .from('research_jobs')
      .insert({ status: 'queued' as const, lead_ids: leadIds, total: leadIds.length, processed: 0, contacts_found: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create research job: ${error.message}`)
    return data as ResearchJob
  }

  async update(id: string, updates: Partial<Omit<ResearchJob, 'id' | 'created_at'>>): Promise<ResearchJob> {
    const { data, error } = await supabaseAdmin.from('research_jobs').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update research job: ${error.message}`)
    return data as ResearchJob
  }
}
```

- [ ] **Step 6: Create `lead-source-repository.ts`**

```typescript
// packages/db/src/repositories/lead-source-repository.ts
import { supabaseAdmin } from '../client'
import type { LeadSource } from '../types'

export class LeadSourceRepository {
  async create(source: { type: string; label: string; scrape_job_id?: string | null }): Promise<LeadSource> {
    const { data, error } = await supabaseAdmin
      .from('lead_sources')
      .insert({ type: source.type, label: source.label, scrape_job_id: source.scrape_job_id ?? null, leads_count: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create lead source: ${error.message}`)
    return data as LeadSource
  }

  async updateCount(id: string, count: number): Promise<LeadSource> {
    const { data, error } = await supabaseAdmin
      .from('lead_sources')
      .update({ leads_count: count })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update lead source count: ${error.message}`)
    return data as LeadSource
  }
}
```

- [ ] **Step 7: Create `revenue-event-repository.ts`**

```typescript
// packages/db/src/repositories/revenue-event-repository.ts
import { supabaseAdmin } from '../client'
import type { RevenueEvent } from '../types'

export class RevenueEventRepository {
  async add(event: Omit<RevenueEvent, 'id'>): Promise<RevenueEvent> {
    const { data, error } = await supabaseAdmin.from('revenue_events').insert(event).select().single()
    if (error) throw new Error(`Failed to add revenue event: ${error.message}`)
    return data as RevenueEvent
  }

  async getSummary() {
    const { data, error } = await supabaseAdmin
      .from('revenue_events')
      .select('*, clients(business_name, retainer_active, retainer_amount)')
    if (error) throw new Error(`Failed to fetch revenue summary: ${error.message}`)
    return data
  }

  async getForClient(clientId: string): Promise<RevenueEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('revenue_events')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
    if (error) throw new Error(`Failed to fetch revenue events: ${error.message}`)
    return data as RevenueEvent[]
  }

  async getMRR(): Promise<number> {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('retainer_amount')
      .eq('retainer_active', true)
    return data?.reduce((sum, c) => sum + (c.retainer_amount || 0), 0) ?? 0
  }
}
```

- [ ] **Step 8: Create `repositories/index.ts` barrel**

```typescript
// packages/db/src/repositories/index.ts
export { LeadRepository } from './lead-repository'
export { ClientRepository } from './client-repository'
export { ScrapeJobRepository } from './scrape-job-repository'
export { CallLogRepository } from './call-log-repository'
export { ContactRepository } from './contact-repository'
export { ResearchJobRepository } from './research-job-repository'
export { LeadSourceRepository } from './lead-source-repository'
export { RevenueEventRepository } from './revenue-event-repository'
```

- [ ] **Step 9: Add export to `packages/db/src/index.ts`**

Add:
```typescript
export * from './repositories'
```

- [ ] **Step 10: Verify typecheck**

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter @agency-os/db typecheck
```
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add packages/db/src/repositories/
git add packages/db/src/index.ts
git commit -m "feat: add repository layer for all domain entities"
```

---

## Chunk 3: Attio API Client Package

### Task 7: Create `@agency-os/attio` package

**Files:**
- Create: `packages/attio/package.json`
- Create: `packages/attio/tsconfig.json`
- Create: `packages/attio/src/types.ts`
- Create: `packages/attio/src/client.ts`
- Create: `packages/attio/src/index.ts`

- [ ] **Step 1: Create `packages/attio/package.json`**

```json
{
  "name": "@agency-os/attio",
  "version": "0.0.1",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

- [ ] **Step 2: Create `packages/attio/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "module": "CommonJS",
    "moduleResolution": "node",
    "declaration": true
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Create `packages/attio/src/types.ts`**

```typescript
// packages/attio/src/types.ts
export interface AttioEntry {
  entryId: string
  recordId: string
  name: string
  values: Record<string, unknown>
  createdAt: string
}

export interface AttioListEntry {
  id?: { entry_id?: string }
  parent_record_id?: string
  entry_values?: Record<string, unknown[]>
  created_at?: string
}

export interface AttioSelfResponse {
  data?: {
    workspace?: {
      name?: string
    }
  }
}

export interface AttioDiffField {
  field: string
  supabase: string
  attio: string
}

export interface AttioDiffEntry {
  leadId: string
  leadName: string
  recordId: string
  diffs: AttioDiffField[]
  entryValues: Record<string, unknown>
}
```

- [ ] **Step 4: Create `packages/attio/src/client.ts`**

```typescript
// packages/attio/src/client.ts
import type { AttioEntry, AttioListEntry, AttioSelfResponse } from './types'

export class AttioClient {
  private baseUrl = 'https://api.attio.com/v2'
  private headers: Record<string, string>

  constructor(
    private apiKey: string,
    private listId: string,
  ) {
    this.headers = {
      Authorization: `Bearer ${this.apiKey}`,
      'Content-Type': 'application/json',
    }
  }

  async verifyConnection(): Promise<{ workspace: string }> {
    const resp = await fetch(`${this.baseUrl}/self`, { headers: this.headers })
    if (!resp.ok) throw new Error(`Auth failed: HTTP ${resp.status}`)
    const data: AttioSelfResponse = await resp.json()
    return { workspace: data.data?.workspace?.name ?? 'Unknown' }
  }

  async getListName(): Promise<string> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}`, { headers: this.headers })
    if (!resp.ok) throw new Error(`Failed to get list: HTTP ${resp.status}`)
    const data = await resp.json()
    return data.data?.name ?? this.listId
  }

  async fetchAllEntries(): Promise<AttioEntry[]> {
    const entries: AttioEntry[] = []
    let offset = 0
    const pageSize = 500

    while (true) {
      const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries/query`, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify({ limit: pageSize, offset }),
        cache: 'no-store',
      })
      if (!resp.ok) throw new Error(`Failed to fetch entries: HTTP ${resp.status}`)

      const data = await resp.json()
      const page: AttioListEntry[] = data.data ?? []

      for (const entry of page) {
        entries.push(this.parseEntry(entry))
      }

      if (page.length < pageSize) break
      offset += pageSize
    }

    return entries
  }

  async upsertEntry(recordId: string, entryValues: Record<string, unknown>): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries`, {
      method: 'PUT',
      headers: this.headers,
      body: JSON.stringify({
        data: {
          parent_record_id: recordId,
          parent_object: 'companies',
          entry_values: entryValues,
        },
      }),
    })

    if (!resp.ok) {
      const errData = await resp.json().catch(() => null)
      throw new Error(errData?.message ?? `HTTP ${resp.status}`)
    }
  }

  async deleteEntry(entryId: string): Promise<void> {
    const resp = await fetch(`${this.baseUrl}/lists/${this.listId}/entries/${entryId}`, {
      method: 'DELETE',
      headers: this.headers,
    })
    if (!resp.ok) throw new Error(`Failed to delete entry: HTTP ${resp.status}`)
  }

  private attioVal(arr: unknown): unknown {
    if (!Array.isArray(arr) || arr.length === 0) return undefined
    const first = arr[0] as Record<string, unknown>
    if (first.value !== undefined) return first.value
    if (first.domain !== undefined) return first.domain
    const option = first.option as Record<string, unknown> | undefined
    if (option?.title !== undefined) return option.title
    return undefined
  }

  private parseEntry(raw: AttioListEntry): AttioEntry {
    const vals = raw.entry_values ?? {}
    const name = ((vals.company_name?.[0] as Record<string, unknown>)?.value as string | undefined)
      ?? ((vals.name?.[0] as Record<string, unknown>)?.value as string | undefined)
      ?? ''
    const flat: Record<string, unknown> = {}
    for (const [key, arr] of Object.entries(vals)) {
      flat[key] = this.attioVal(arr)
    }
    return {
      entryId: raw.id?.entry_id ?? '',
      recordId: raw.parent_record_id ?? '',
      name,
      values: flat,
      createdAt: raw.created_at ?? '',
    }
  }
}
```

- [ ] **Step 5: Create `packages/attio/src/index.ts`**

```typescript
export { AttioClient } from './client'
export type { AttioEntry, AttioListEntry, AttioSelfResponse, AttioDiffField, AttioDiffEntry } from './types'
```

- [ ] **Step 6: Install and verify**

```bash
cd /Users/fahimanik/code/agency-os && pnpm install
pnpm --filter @agency-os/attio typecheck
```
Expected: PASS

- [ ] **Step 7: Add `@agency-os/attio` dependency to dashboard**

```bash
cd /Users/fahimanik/code/agency-os && pnpm add @agency-os/attio --filter dashboard --workspace
```

- [ ] **Step 8: Commit**

```bash
git add packages/attio/ apps/dashboard/package.json pnpm-lock.yaml
git commit -m "feat: create @agency-os/attio package with typed API client"
```

---

## Chunk 4: Service Layer & DI Container

### Task 8: Create auth guard

**Files:**
- Create: `apps/dashboard/src/lib/auth.ts`

- [ ] **Step 1: Create `auth.ts`**

```typescript
// apps/dashboard/src/lib/auth.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function requireAuth() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server component context — middleware handles refresh
          }
        },
      },
    }
  )
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) throw new Error('Unauthorized')
  return user
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/lib/auth.ts
git commit -m "feat: add requireAuth guard using @supabase/ssr"
```

---

### Task 9: Create AttioSyncService

**Files:**
- Create: `apps/dashboard/src/services/attio-sync-service.ts`

- [ ] **Step 1: Create the service**

```typescript
// apps/dashboard/src/services/attio-sync-service.ts
import type { AttioClient, AttioDiffEntry, AttioDiffField } from '@agency-os/attio'
import type { LeadRepository } from '@agency-os/db'
import type { Lead } from '@agency-os/db'
import { AttioSyncStatus } from '@agency-os/db'

const STATUS_MAP: Record<string, string> = {
  new: 'New', scoring: 'Scoring', needs_review: 'Needs Review',
  approved: 'Approved', sent: 'Sent', replied: 'Replied',
  booked: 'Booked', closed: 'Closed', skip: 'Skip',
}

export class AttioSyncService {
  constructor(
    private attioClient: AttioClient,
    private leadRepo: LeadRepository,
  ) {}

  async fetchEntries(): Promise<{
    workspace: string
    listName: string
    entries: { company_name: string; values: Record<string, unknown> }[]
  }> {
    const { workspace } = await this.attioClient.verifyConnection()
    const listName = await this.attioClient.getListName()
    const entries = await this.attioClient.fetchAllEntries()
    return {
      workspace,
      listName,
      entries: entries.map(e => ({ company_name: e.name, values: e.values })),
    }
  }

  async deduplicate(): Promise<{ duplicatesFound: number; removed: number; failed: number }> {
    const entries = await this.attioClient.fetchAllEntries()
    const byName = new Map<string, typeof entries>()
    for (const e of entries) {
      const key = e.name.toLowerCase().trim()
      if (!key) continue
      const group = byName.get(key) ?? []
      group.push(e)
      byName.set(key, group)
    }

    const toDelete: { entryId: string; name: string }[] = []
    for (const [, group] of byName) {
      if (group.length <= 1) continue
      group.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
      for (let i = 1; i < group.length; i++) {
        toDelete.push({ entryId: group[i].entryId, name: group[i].name })
      }
    }

    if (toDelete.length === 0) return { duplicatesFound: 0, removed: 0, failed: 0 }

    let removed = 0
    let failed = 0
    for (const dup of toDelete) {
      try {
        await this.attioClient.deleteEntry(dup.entryId)
        removed++
      } catch {
        failed++
      }
    }
    return { duplicatesFound: toDelete.length, removed, failed }
  }

  async compare(): Promise<{
    diffs: AttioDiffEntry[]
    unchanged: number
    unmatched: number
    supabaseCount: number
    attioCount: number
  }> {
    const [leads, attioEntries] = await Promise.all([
      this.leadRepo.getAll(),
      this.attioClient.fetchAllEntries(),
    ])

    const attioByName = new Map(
      attioEntries.map(e => [e.name.toLowerCase().trim(), e])
    )

    const diffs: AttioDiffEntry[] = []
    let unchanged = 0
    let unmatched = 0

    for (const lead of leads) {
      const attioEntry = attioByName.get(lead.name.toLowerCase().trim())
      if (!attioEntry) { unmatched++; continue }

      const desired = this.leadToAttioValues(lead)
      const diffFields: AttioDiffField[] = []

      for (const [key, desiredVal] of Object.entries(desired)) {
        const desiredStr = String(desiredVal ?? '')
        const attioStr = String(attioEntry.values[key] ?? '')
        if (desiredStr !== attioStr) {
          diffFields.push({ field: key, supabase: desiredStr || '(empty)', attio: attioStr || '(empty)' })
        }
      }

      if (diffFields.length === 0) { unchanged++; continue }

      diffs.push({
        leadId: lead.id,
        leadName: lead.name,
        recordId: attioEntry.recordId,
        diffs: diffFields,
        entryValues: desired,
      })
    }

    return { diffs, unchanged, unmatched, supabaseCount: leads.length, attioCount: attioEntries.length }
  }

  async syncEntry(entry: {
    leadId: string
    leadName: string
    recordId: string
    entryValues: Record<string, unknown>
    changedFields: string[]
  }): Promise<{ ok: boolean; error?: string }> {
    const patchValues: Record<string, unknown> = { company_name: entry.entryValues.company_name }
    for (const field of entry.changedFields) {
      if (field !== 'company_name') patchValues[field] = entry.entryValues[field]
    }

    try {
      await this.attioClient.upsertEntry(entry.recordId, patchValues)
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Synced)
      return { ok: true }
    } catch (err) {
      await this.leadRepo.updateAttioSync(entry.leadId, AttioSyncStatus.Failed).catch(() => {})
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  private leadToAttioValues(lead: Lead): Record<string, unknown> {
    const v: Record<string, unknown> = { company_name: lead.name }
    if (lead.website) v.website = lead.website
    if (lead.phone) v.phone = lead.phone
    if (lead.place_id) v.place_id = lead.place_id
    if (lead.reviews_raw) v.reviews_raw = lead.reviews_raw
    if (lead.pain_points) v.pain_points = lead.pain_points
    if (lead.suggested_angle) v.suggested_angle = lead.suggested_angle
    if (lead.message_draft) v.message_draft = lead.message_draft
    if (lead.email_found) v.email_found = lead.email_found
    if (lead.notes) v.notes = lead.notes
    v.has_booking = lead.has_booking
    v.has_chat_widget = lead.has_chat_widget
    v.has_contact_form = lead.has_contact_form
    if (lead.pain_score != null) v.pain_score = lead.pain_score
    if (lead.review_count != null && lead.review_count > 0) {
      v.review_count = lead.review_count
      v.count = lead.review_count
    }
    if (lead.rating != null) v.rating_3 = `${lead.rating}/5`
    if (lead.analyze) v.analyze = lead.analyze
    if (lead.status && STATUS_MAP[lead.status]) v.status = STATUS_MAP[lead.status]
    if (lead.follow_up_date) v.follow_up_date = lead.follow_up_date
    if (lead.niche) v.niche = lead.niche
    if (lead.city) v.city = lead.city
    if (lead.address) v.address = lead.address
    if (lead.maps_url) v.maps_url = lead.maps_url
    return v
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/services/attio-sync-service.ts
git commit -m "feat: add AttioSyncService with compare, sync, dedup logic"
```

---

### Task 10: Create LeadService and ScraperService

**Files:**
- Create: `apps/dashboard/src/services/lead-service.ts`
- Create: `apps/dashboard/src/services/scraper-service.ts`

- [ ] **Step 1: Create `lead-service.ts`**

```typescript
// apps/dashboard/src/services/lead-service.ts
import type { LeadRepository, LeadSourceRepository } from '@agency-os/db'
import { LeadStatus, CallOutcome, AttioSyncStatus } from '@agency-os/db'

export class LeadService {
  constructor(
    private leadRepo: LeadRepository,
    private sourceRepo: LeadSourceRepository,
  ) {}

  async updateStatus(leadId: string, status: LeadStatus, notes?: string) {
    return this.leadRepo.updateStatus(leadId, status, notes)
  }

  outcomeToLeadStatus(outcome: CallOutcome): LeadStatus {
    switch (outcome) {
      case CallOutcome.DemoBooked: return LeadStatus.Booked
      case CallOutcome.Closed: return LeadStatus.Closed
      case CallOutcome.NotInterested: return LeadStatus.Skip
      default: return LeadStatus.Sent
    }
  }

  async importLeads(leads: Array<{
    name: string; niche: string | null; phone: string | null;
    email: string | null; website: string | null;
    pain_score: number | null; city: string | null;
  }>, fileName?: string) {
    const source = await this.sourceRepo.create({
      type: 'import',
      label: fileName || `Import (${leads.length} leads)`,
    })

    const leadsToInsert = leads.map(l => ({
      name: l.name, niche: l.niche, phone: l.phone, website: l.website,
      address: null, rating: null, review_count: 0, maps_url: null,
      place_id: null, city: l.city, has_website: !!l.website,
      site_quality: null, pain_score: l.pain_score, pain_points: null,
      suggested_angle: null, message_draft: null, email_found: l.email,
      has_booking: false, has_chat_widget: false, has_contact_form: false,
      reviews_raw: null, follow_up_date: null, notes: null,
      page_load_ms: null, mobile_friendly: null, has_ssl: null,
      seo_issues: null, has_cta: null, phone_on_site: null,
      hours_on_site: null, has_social_proof: null, tech_stack: null,
      analyze: null, status: LeadStatus.New as LeadStatus,
      attio_sync_status: AttioSyncStatus.NotSynced as AttioSyncStatus,
      attio_synced_at: null, source_id: source.id,
    }))

    const result = await this.leadRepo.bulkUpsert(leadsToInsert)
    await this.sourceRepo.updateCount(source.id, result.inserted)
    return result
  }
}
```

- [ ] **Step 2: Create `scraper-service.ts`**

```typescript
// apps/dashboard/src/services/scraper-service.ts
import type { ScrapeJobRepository } from '@agency-os/db'
import type { ScrapeJobStatus } from '@agency-os/db'

export class ScraperService {
  constructor(
    private jobRepo: ScrapeJobRepository,
    private scraperServiceUrl: string,
    private scraperSecret?: string,
  ) {}

  async createJob(params: { niches: string[]; location: string; city: string; maxPerNiche: number; withEmails: boolean }) {
    return this.jobRepo.create({
      niches: params.niches,
      location: params.location,
      city: params.city,
      max_per_niche: params.maxPerNiche,
      with_emails: params.withEmails,
    })
  }

  async triggerScrape(params: {
    niches: string[]; location: string;
    maxPerNiche: number; withEmails: boolean;
  }): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.scraperSecret) {
      headers['Authorization'] = `Bearer ${this.scraperSecret}`
    }

    const resp = await fetch(`${this.scraperServiceUrl}/scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
    if (!resp.ok) {
      const err = await resp.text().catch(() => `HTTP ${resp.status}`)
      throw new Error(`Scraper error: ${err}`)
    }
    return resp.json()
  }

  async triggerResearch(leadIds: string[]): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.scraperSecret) {
      headers['Authorization'] = `Bearer ${this.scraperSecret}`
    }

    const resp = await fetch(`${this.scraperServiceUrl}/research`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadIds }),
    })
    if (!resp.ok) {
      const err = await resp.text().catch(() => `HTTP ${resp.status}`)
      throw new Error(`Research error: ${err}`)
    }
    return resp.json()
  }

  async updateJobStatus(id: string, status: ScrapeJobStatus) {
    return this.jobRepo.update(id, {
      status,
      finished_at: new Date().toISOString(),
    })
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/services/lead-service.ts apps/dashboard/src/services/scraper-service.ts
git commit -m "feat: add LeadService and ScraperService"
```

---

### Task 11: Create DI Container

**Files:**
- Create: `apps/dashboard/src/lib/container.ts`

- [ ] **Step 1: Create `container.ts`**

```typescript
// apps/dashboard/src/lib/container.ts
import {
  LeadRepository, LeadSourceRepository, CallLogRepository,
  ScrapeJobRepository, ClientRepository, ContactRepository,
  ResearchJobRepository, RevenueEventRepository,
} from '@agency-os/db'
import { AttioClient } from '@agency-os/attio'
import { AttioSyncService } from '@/services/attio-sync-service'
import { LeadService } from '@/services/lead-service'
import { ScraperService } from '@/services/scraper-service'

interface Container {
  // Repositories
  leadRepo: LeadRepository
  callLogRepo: CallLogRepository
  clientRepo: ClientRepository
  contactRepo: ContactRepository
  researchJobRepo: ResearchJobRepository
  revenueRepo: RevenueEventRepository
  // Services
  leadService: LeadService
  attioSyncService: AttioSyncService
  scraperService: ScraperService
}

let _container: Container | null = null

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env var: ${name}`)
  return value
}

function createContainer(): Container {
  const leadRepo = new LeadRepository()
  const sourceRepo = new LeadSourceRepository()
  const callLogRepo = new CallLogRepository()
  const jobRepo = new ScrapeJobRepository()
  const clientRepo = new ClientRepository()
  const contactRepo = new ContactRepository()
  const researchJobRepo = new ResearchJobRepository()
  const revenueRepo = new RevenueEventRepository()

  const attioClient = new AttioClient(
    requireEnv('ATTIO_API_KEY'),
    requireEnv('ATTIO_LIST_ID'),
  )

  const leadService = new LeadService(leadRepo, sourceRepo)
  const attioSyncService = new AttioSyncService(attioClient, leadRepo)
  const scraperService = new ScraperService(jobRepo, requireEnv('SCRAPER_SERVICE_URL'), process.env.SCRAPER_SECRET)

  return {
    leadRepo, callLogRepo, clientRepo, contactRepo, researchJobRepo, revenueRepo,
    leadService, attioSyncService, scraperService,
  }
}

export const container = new Proxy({} as Container, {
  get(_, prop: string) {
    if (!_container) _container = createContainer()
    return (_container as Record<string, unknown>)[prop]
  },
})
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/fahimanik/code/agency-os && pnpm build
```
Expected: PASS — new files don't affect existing code yet.

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/lib/container.ts
git commit -m "feat: add DI container with lazy Proxy singleton"
```

---

## Chunk 5: Controller Refactoring

### Task 12: Refactor `leads/actions.ts`

**Files:**
- Modify: `apps/dashboard/src/app/leads/actions.ts`

- [ ] **Step 1: Rewrite `leads/actions.ts`**

Replace the entire file with:

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import type { LeadStatus, CallOutcome } from '@agency-os/db'
import {
  updateLeadStatusSchema, logCallSchema, importLeadsSchema,
  updateSingleAttioEntrySchema,
} from '@agency-os/db'

export async function updateLeadStatusAction(leadId: string, status: LeadStatus, notes?: string) {
  await requireAuth()
  const parsed = updateLeadStatusSchema.parse({ leadId, status, notes })
  await container.leadService.updateStatus(parsed.leadId, parsed.status, parsed.notes)
  revalidatePath('/leads')
}

export async function logCallAction(
  leadId: string,
  outcome: CallOutcome,
  notes: string,
  durationSeconds: number | null
) {
  await requireAuth()
  const parsed = logCallSchema.parse({ leadId, outcome, notes, durationSeconds })
  const newStatus = container.leadService.outcomeToLeadStatus(parsed.outcome)

  await Promise.all([
    container.callLogRepo.log({
      lead_id: parsed.leadId,
      outcome: parsed.outcome,
      notes: parsed.notes || null,
      duration_seconds: parsed.durationSeconds,
    }),
    container.leadService.updateStatus(parsed.leadId, newStatus, parsed.notes || undefined),
  ])

  revalidatePath('/leads')
}

export async function fetchAttioEntriesAction() {
  await requireAuth()
  try {
    const result = await container.attioSyncService.fetchEntries()
    return { ok: true as const, ...result }
  } catch (err) {
    return { ok: false as const, error: String(err), entries: [] as { company_name: string; values: Record<string, unknown> }[] }
  }
}

export async function compareAttioAction() {
  unstable_noStore()
  await requireAuth()
  try {
    const result = await container.attioSyncService.compare()
    return { ok: true as const, ...result }
  } catch (err) {
    return { ok: false as const, error: String(err), diffs: [], unchanged: 0, unmatched: 0, supabaseCount: 0, attioCount: 0 }
  }
}

export async function deduplicateAttioAction() {
  await requireAuth()
  try {
    return { ok: true as const, ...await container.attioSyncService.deduplicate() }
  } catch (err) {
    return { ok: false as const, error: String(err), duplicatesFound: 0, removed: 0, failed: 0 }
  }
}

export async function updateSingleAttioEntryAction(entry: {
  leadId: string
  leadName: string
  recordId: string
  entryValues: Record<string, unknown>
  changedFields: string[]
}) {
  await requireAuth()
  const parsed = updateSingleAttioEntrySchema.parse(entry)
  return container.attioSyncService.syncEntry(parsed)
}

interface ParsedLead {
  name: string
  niche: string | null
  phone: string | null
  email: string | null
  website: string | null
  pain_score: number | null
  city: string | null
}

export async function importLeadsAction(leads: ParsedLead[], fileName?: string) {
  await requireAuth()
  const parsed = importLeadsSchema.parse({ leads, fileName })
  const result = await container.leadService.importLeads(parsed.leads, parsed.fileName)
  revalidatePath('/leads')
  return result
}
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/fahimanik/code/agency-os && pnpm build
```

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/leads/actions.ts
git commit -m "refactor: leads/actions.ts to use services, auth, and Zod validation"
```

---

### Task 13: Refactor `scraper/actions.ts`

**Files:**
- Modify: `apps/dashboard/src/app/scraper/actions.ts`

- [ ] **Step 1: Rewrite `scraper/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { triggerScrapeSchema, updateJobStatusSchema } from '@agency-os/db'

export async function triggerScrape(formData: FormData) {
  await requireAuth()

  const parsed = triggerScrapeSchema.parse({
    niches: (formData.get('niches') as string).split(',').map(n => n.trim()).filter(Boolean),
    location: formData.get('location') as string,
    maxPerNiche: parseInt(formData.get('maxPerNiche') as string, 10) || 20,
    withEmails: formData.get('withEmails') === 'on',
  })

  await container.scraperService.createJob({ ...parsed, city: parsed.location })
  const result = await container.scraperService.triggerScrape(parsed)

  revalidatePath('/scraper')
  return result
}

export async function updateJobStatusAction(jobId: string, status: 'done' | 'failed') {
  await requireAuth()
  const parsed = updateJobStatusSchema.parse({ jobId, status })
  await container.scraperService.updateJobStatus(parsed.jobId, parsed.status as 'done' | 'failed')
  revalidatePath('/scraper')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/scraper/actions.ts
git commit -m "refactor: scraper/actions.ts to use services, auth, and Zod"
```

---

### Task 14: Refactor `clients/actions.ts`

**Files:**
- Modify: `apps/dashboard/src/app/clients/actions.ts`

- [ ] **Step 1: Rewrite `clients/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { createClientSchema, updateClientSchema } from '@agency-os/db'
import { LeadStatus, SiteStatus } from '@agency-os/db'
import type { Client } from '@agency-os/db'

export async function createClientAction(formData: FormData) {
  await requireAuth()

  const parsed = createClientSchema.parse({
    lead_id: (formData.get('lead_id') as string) || null,
    business_name: formData.get('business_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    niche: (formData.get('niche') as string) || null,
    city: (formData.get('city') as string) || null,
    deal_value: formData.get('deal_value') ? parseFloat(formData.get('deal_value') as string) : null,
  })

  await container.clientRepo.create({
    ...parsed,
    site_url: null,
    github_repo: null,
    vercel_project_id: null,
    paid_upfront: 0,
    paid_final: 0,
    retainer_amount: 0,
    retainer_active: false,
    retainer_billing_day: null,
    site_status: SiteStatus.Building,
  } as Omit<Client, 'id' | 'created_at'>)

  if (parsed.lead_id) {
    await container.leadRepo.updateStatus(parsed.lead_id, LeadStatus.Closed)
  }

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function convertLeadToClientAction(leadId: string) {
  await requireAuth()

  const lead = await container.leadRepo.getById(leadId)

  await container.clientRepo.create({
    lead_id: leadId,
    business_name: lead.name,
    contact_name: null,
    phone: lead.phone,
    email: lead.email_found,  // Fix: was incorrectly using lead.email
    niche: lead.niche,
    city: lead.city,
    site_url: null,
    github_repo: null,
    vercel_project_id: null,
    deal_value: null,
    paid_upfront: 0,
    paid_final: 0,
    retainer_amount: 0,
    retainer_active: false,
    retainer_billing_day: null,
    site_status: SiteStatus.Building,
  } as Omit<Client, 'id' | 'created_at'>)

  await container.leadRepo.updateStatus(leadId, LeadStatus.Closed)

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function updateClientAction(id: string, formData: FormData) {
  await requireAuth()

  const parsed = updateClientSchema.parse({
    id,
    business_name: formData.get('business_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    niche: (formData.get('niche') as string) || null,
    city: (formData.get('city') as string) || null,
    site_url: (formData.get('site_url') as string) || null,
    deal_value: formData.get('deal_value') ? parseFloat(formData.get('deal_value') as string) : null,
    paid_upfront: parseFloat(formData.get('paid_upfront') as string) || 0,
    paid_final: parseFloat(formData.get('paid_final') as string) || 0,
    retainer_amount: parseFloat(formData.get('retainer_amount') as string) || 0,
    retainer_active: formData.get('retainer_active') === 'on',
    retainer_billing_day: formData.get('retainer_billing_day')
      ? parseInt(formData.get('retainer_billing_day') as string, 10)
      : null,
    site_status: (formData.get('site_status') as string) || SiteStatus.Building,
  })

  const { id: _id, ...updates } = parsed
  await container.clientRepo.update(id, updates as Partial<Omit<Client, 'id' | 'created_at'>>)

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/clients/actions.ts
git commit -m "refactor: clients/actions.ts — auth, Zod, fix lead.email bug"
```

---

### Task 15: Refactor `contacts/actions.ts`

**Files:**
- Modify: `apps/dashboard/src/app/contacts/actions.ts`

- [ ] **Step 1: Rewrite `contacts/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import {
  triggerResearchSchema, updateContactTagsSchema,
  updateContactNotesSchema, linkContactToLeadSchema,
} from '@agency-os/db'

export async function triggerResearchAction(leadIds: string[]) {
  await requireAuth()
  const parsed = triggerResearchSchema.parse({ leadIds })
  const result = await container.scraperService.triggerResearch(parsed.leadIds)
  revalidatePath('/contacts')
  return result
}

export async function updateContactTagsAction(contactId: string, tags: string[]) {
  await requireAuth()
  const parsed = updateContactTagsSchema.parse({ contactId, tags })
  await container.contactRepo.updateTags(parsed.contactId, parsed.tags)
  revalidatePath('/contacts')
}

export async function updateContactNotesAction(contactId: string, notes: string) {
  await requireAuth()
  const parsed = updateContactNotesSchema.parse({ contactId, notes })
  await container.contactRepo.update(parsed.contactId, { notes: parsed.notes })
  revalidatePath('/contacts')
}

export async function linkContactToLeadAction(contactId: string, leadId: string | null) {
  await requireAuth()
  const parsed = linkContactToLeadSchema.parse({ contactId, leadId })
  const data = await container.contactRepo.linkToLead(parsed.contactId, parsed.leadId)

  if (parsed.leadId) {
    const lead = await container.leadRepo.getById(parsed.leadId)
    if (lead?.niche) {
      const contact = data as { tags?: string[] }
      const currentTags: string[] = contact?.tags ?? []
      if (!currentTags.includes(lead.niche)) {
        await container.contactRepo.updateTags(parsed.contactId, [...currentTags, lead.niche])
      }
    }
  }

  revalidatePath('/contacts')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/contacts/actions.ts
git commit -m "refactor: contacts/actions.ts — auth, Zod, use container"
```

---

### Task 16: Refactor `revenue/actions.ts`

**Files:**
- Modify: `apps/dashboard/src/app/revenue/actions.ts`

- [ ] **Step 1: Rewrite `revenue/actions.ts`**

```typescript
'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { addRevenueEventSchema } from '@agency-os/db'

export async function addRevenueEventAction(formData: FormData) {
  await requireAuth()

  const parsed = addRevenueEventSchema.parse({
    client_id: formData.get('client_id') as string,
    type: formData.get('type') as string,
    amount: parseFloat(formData.get('amount') as string),
    date: formData.get('date') as string,
    notes: (formData.get('notes') as string) || null,
  })

  await container.revenueRepo.add(parsed)
  revalidatePath('/revenue')
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/revenue/actions.ts
git commit -m "refactor: revenue/actions.ts — auth, Zod, use container"
```

---

### Task 17: Fix `leads/page.tsx` minQuality bug

**Files:**
- Modify: `apps/dashboard/src/app/leads/page.tsx`

- [ ] **Step 1: Fix the filter key**

In `apps/dashboard/src/app/leads/page.tsx`, change:
```typescript
minQuality: params.min_quality ? parseInt(params.min_quality, 10) : undefined,
```
to:
```typescript
minPainScore: params.min_quality ? parseInt(params.min_quality, 10) : undefined,
```

- [ ] **Step 2: Verify build**

```bash
cd /Users/fahimanik/code/agency-os && pnpm build
```
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/dashboard/src/app/leads/page.tsx
git commit -m "fix: rename minQuality to minPainScore to match query filter"
```

---

## Chunk 6: Cleanup

### Task 18: Final build verification and cleanup

**Files:**
- Modify: `packages/db/src/queries.ts` (keep as-is — backward compat for scraper-service)

- [ ] **Step 1: Full build**

```bash
cd /Users/fahimanik/code/agency-os && pnpm build
```
Expected: All packages build successfully.

- [ ] **Step 2: Verify scraper-service still compiles**

The `apps/scraper-service/src/index.ts` imports from `@agency-os/db` using the old function names. `queries.ts` is NOT removed — it stays as-is for backward compat.

```bash
cd /Users/fahimanik/code/agency-os && pnpm --filter scraper-service typecheck 2>/dev/null || pnpm build --filter scraper-service
```

- [ ] **Step 3: Commit any remaining fixes**

If any build errors were found, fix them and commit:

```bash
git add -A
git commit -m "fix: resolve build issues from architecture refactoring"
```

- [ ] **Step 4: Final commit — mark refactoring complete**

```bash
git log --oneline -15
```

Verify all commits are in order and the refactoring is complete.
