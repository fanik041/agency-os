# Architecture Refactoring Design Spec

**Date:** 2026-03-17
**Status:** Approved (pending implementation)

## Goals

1. **Eliminate all `any` types** — replace with proper TypeScript types and Zod schemas
2. **Add enums where necessary** — replace string literal unions with runtime enums
3. **Layer the architecture** — Controller → Service → Repository → API Client
4. **Add security guards** — auth checks, input validation, injection prevention

## Current State

The codebase has a flat architecture:
- Server actions in `actions.ts` files directly call Supabase and Attio APIs
- Types are defined as string literal unions in `packages/db/src/types.ts`
- No input validation on server action boundaries
- `any` types scattered across Attio API interactions
- No auth checks in server actions
- Inline fetch calls to Attio API without typed wrappers

## Architecture Overview

```
┌──────────────────────────────────────────────┐
│  Next.js Server Actions (Controller Layer)   │
│  - Zod input validation                      │
│  - Auth checks (requireAuth)                 │
│  - Delegates to services                     │
├──────────────────────────────────────────────┤
│  Service Layer                               │
│  - Business logic, orchestration             │
│  - LeadService, AttioSyncService, etc.       │
├──────────────────────────────────────────────┤
│  Repository Layer          │  API Client     │
│  - Supabase queries        │  - Typed Attio  │
│  - Date normalization      │    API wrapper  │
│  - Data access patterns    │  - Request/     │
│                            │    response     │
│                            │    types        │
├──────────────────────────────────────────────┤
│  Types / Enums / Zod Schemas                 │
│  - Runtime enums                             │
│  - Shared Zod schemas                        │
│  - Attio API types                           │
└──────────────────────────────────────────────┘
```

---

## Layer 1: Types, Enums, and Zod Schemas

### Location: `packages/db/src/`

### Enums (runtime values)

Convert string literal unions to enums for runtime validation:

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

### Zod Schemas

Add Zod schemas for server action input validation:

```typescript
// packages/db/src/schemas.ts
import { z } from 'zod'
import { LeadStatus, CallOutcome, AttioSyncStatus } from './enums'

export const updateLeadStatusSchema = z.object({
  leadId: z.string().uuid(),
  status: z.nativeEnum(LeadStatus),
  notes: z.string().max(5000).optional(),
})

export const logCallSchema = z.object({
  leadId: z.string().uuid(),
  outcome: z.nativeEnum(CallOutcome),
  notes: z.string().max(5000),
  durationSeconds: z.number().int().nonnull().nullable(),
})

export const importLeadsSchema = z.object({
  leads: z.array(z.object({
    name: z.string().min(1).max(500),
    niche: z.string().max(200).nullable(),
    phone: z.string().max(50).nullable(),
    email: z.string().email().nullable(),
    website: z.string().url().nullable(),
    pain_score: z.number().int().min(0).max(100).nullable(),
    city: z.string().max(200).nullable(),
  })).min(1).max(10000),
  fileName: z.string().max(500).optional(),
})

export const updateSingleAttioEntrySchema = z.object({
  leadId: z.string().uuid(),
  leadName: z.string().min(1),
  recordId: z.string().min(1),
  entryValues: z.record(z.unknown()),
  changedFields: z.array(z.string()),
})
```

### Interface Updates

Update interfaces to use enums instead of string literals:

```typescript
// packages/db/src/types.ts (updated)
import { LeadStatus, AttioSyncStatus, ScrapeJobStatus, /* etc */ } from './enums'

export interface Lead {
  id: string
  name: string
  status: LeadStatus      // was: 'new' | 'scoring' | ...
  attio_sync_status: AttioSyncStatus  // was: 'not_synced' | ...
  // ... rest unchanged
}
```

---

## Layer 2: Repository Layer

### Location: `packages/db/src/repositories/`

Wrap Supabase queries with proper types. The existing `queries.ts` becomes the basis — split into domain-specific repositories.

```typescript
// packages/db/src/repositories/lead-repository.ts
import { supabaseAdmin } from '../client'
import type { Lead } from '../types'
import { LeadStatus, AttioSyncStatus } from '../enums'

export class LeadRepository {
  async getAll() {
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
  }) {
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
    return query
  }

  async updateStatus(id: string, status: LeadStatus, notes?: string) {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ status, notes })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update lead: ${error.message}`)
    return data as Lead
  }

  async updateAttioSync(id: string, syncStatus: AttioSyncStatus) {
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

  async upsert(lead: Omit<Lead, 'id' | 'created_at'> & { id?: string }) {
    if (lead.maps_url) {
      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('maps_url', lead.maps_url)
        .maybeSingle()
      if (existing) {
        return supabaseAdmin
          .from('leads')
          .update(lead)
          .eq('id', existing.id)
          .select()
          .single()
      }
    }
    return supabaseAdmin.from('leads').insert(lead).select().single()
  }

  async getFilterOptions() {
    const [nichesRes, citiesRes, sourcesRes] = await Promise.all([
      supabaseAdmin.from('leads').select('niche').not('niche', 'is', null),
      supabaseAdmin.from('leads').select('city').not('city', 'is', null),
      supabaseAdmin.from('lead_sources').select('*').order('created_at', { ascending: false }),
    ])

    const niches = [...new Set((nichesRes.data ?? []).map((r) => r.niche as string))]
    const cities = [...new Set((citiesRes.data ?? []).map((r) => r.city as string))]
    const sources = (sourcesRes.data ?? []) as import('../types').LeadSource[]

    return { niches, cities, sources }
  }
}
```

Similar repositories for:
- `ClientRepository` — client CRUD, revenue queries
- `ScrapeJobRepository` — scrape job CRUD
- `CallLogRepository` — call log queries
- `ContactRepository` — contact CRUD, linking
- `ResearchJobRepository` — research job CRUD
- `LeadSourceRepository` — lead source CRUD

### Date Normalization

Normalize ISO date strings in the repository layer before returning data:

```typescript
private normalizeDate(isoString: string): string {
  return new Date(isoString).toISOString()
}
```

---

## Layer 3: Attio API Client

### Location: `packages/attio/src/`

New package for typed Attio API interactions. Replaces all inline `fetch` calls.

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

  /** Extract scalar value from Attio's array-wrapped entry_values */
  private attioVal(arr: unknown): unknown {
    if (!Array.isArray(arr) || arr.length === 0) return undefined
    const first = arr[0] as Record<string, unknown>
    if (first.value !== undefined) return first.value
    if (first.domain !== undefined) return first.domain
    // Select fields: nested option.title
    const option = first.option as Record<string, unknown> | undefined
    if (option?.title !== undefined) return option.title
    return undefined
  }

  private parseEntry(raw: AttioListEntry): AttioEntry {
    const vals = raw.entry_values ?? {}
    const name = (vals.company_name?.[0] as Record<string, unknown>)?.value as string
      ?? (vals.name?.[0] as Record<string, unknown>)?.value as string
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

### Attio Types

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

---

## Layer 4: Service Layer

### Location: `apps/dashboard/src/services/`

Services contain business logic and orchestrate between repositories and API clients.

### AttioSyncService

```typescript
// apps/dashboard/src/services/attio-sync-service.ts
import type { AttioClient } from '@agency-os/attio'
import type { LeadRepository } from '@agency-os/db'
import type { Lead } from '@agency-os/db'
import type { AttioDiffEntry, AttioDiffField } from '@agency-os/attio'
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

  async deduplicate(): Promise<{ duplicatesFound: number; removed: number; failed: number }> {
    const entries = await this.attioClient.fetchAllEntries()

    // Group by lowercase company name
    const byName = new Map<string, typeof entries>()
    for (const e of entries) {
      const key = e.name.toLowerCase().trim()
      if (!key) continue
      const group = byName.get(key) ?? []
      group.push(e)
      byName.set(key, group)
    }

    // Keep oldest, delete rest
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

### LeadService

```typescript
// apps/dashboard/src/services/lead-service.ts
import type { LeadRepository } from '@agency-os/db'
import type { Lead, LeadStatus, CallOutcome } from '@agency-os/db'

export class LeadService {
  constructor(private leadRepo: LeadRepository) {}

  async updateStatus(leadId: string, status: LeadStatus, notes?: string) {
    return this.leadRepo.updateStatus(leadId, status, notes)
  }

  outcomeToLeadStatus(outcome: CallOutcome): LeadStatus {
    switch (outcome) {
      case 'demo_booked': return 'booked' as LeadStatus
      case 'closed': return 'closed' as LeadStatus
      case 'not_interested': return 'skip' as LeadStatus
      default: return 'sent' as LeadStatus
    }
  }

  async importLeads(leads: Omit<Lead, 'id' | 'created_at'>[], fileName?: string) {
    // Lead source creation + bulk upsert logic
    // Moved from actions.ts
  }
}
```

---

## Layer 5: Controller Layer (Server Actions)

### Pattern

Every server action follows this pattern:

```typescript
export async function someAction(input: unknown) {
  await requireAuth()
  const parsed = someSchema.safeParse(input)
  if (!parsed.success) throw new Error(`Invalid input: ${parsed.error.message}`)
  return container.someService.doThing(parsed.data)
}
```

### Auth Guard

```typescript
// apps/dashboard/src/lib/auth.ts
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function requireAuth() {
  const supabase = createServerComponentClient({ cookies })
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}
```

### Example Controller

```typescript
// apps/dashboard/src/app/leads/actions.ts (refactored)
'use server'

import { unstable_noStore, revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { updateLeadStatusSchema, logCallSchema, importLeadsSchema, updateSingleAttioEntrySchema } from '@agency-os/db'

export async function updateLeadStatusAction(input: unknown) {
  await requireAuth()
  const { leadId, status, notes } = updateLeadStatusSchema.parse(input)
  await container.leadService.updateStatus(leadId, status, notes)
  revalidatePath('/leads')
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

export async function updateSingleAttioEntryAction(input: unknown) {
  await requireAuth()
  const parsed = updateSingleAttioEntrySchema.parse(input)
  return container.attioSyncService.syncEntry(parsed)
}
```

---

## Container / DI Wiring

Constructor injection with manual wiring via lazy Proxy singleton:

```typescript
// apps/dashboard/src/lib/container.ts
import { LeadRepository } from '@agency-os/db'
import { AttioClient } from '@agency-os/attio'
import { AttioSyncService } from '@/services/attio-sync-service'
import { LeadService } from '@/services/lead-service'

interface Container {
  leadRepo: LeadRepository
  attioClient: AttioClient
  leadService: LeadService
  attioSyncService: AttioSyncService
}

let _container: Container | null = null

function createContainer(): Container {
  const leadRepo = new LeadRepository()
  const attioClient = new AttioClient(
    process.env.ATTIO_API_KEY!,
    process.env.ATTIO_LIST_ID!,
  )
  const leadService = new LeadService(leadRepo)
  const attioSyncService = new AttioSyncService(attioClient, leadRepo)

  return { leadRepo, attioClient, leadService, attioSyncService }
}

export const container = new Proxy({} as Container, {
  get(_, prop: string) {
    if (!_container) _container = createContainer()
    return (_container as Record<string, unknown>)[prop]
  },
})
```

---

## Scraper Service Layering

The scraper actions follow the same pattern:

```typescript
// apps/dashboard/src/services/scraper-service.ts
import type { ScrapeJobRepository } from '@agency-os/db'

export class ScraperService {
  constructor(private jobRepo: ScrapeJobRepository) {}

  async createJob(params: { niches: string[]; location: string; city: string; maxPerNiche: number; withEmails: boolean }) {
    return this.jobRepo.create({
      niches: params.niches,
      location: params.location,
      city: params.city,
      max_per_niche: params.maxPerNiche,
      with_emails: params.withEmails,
    })
  }

  async updateJobStatus(id: string, status: 'done' | 'failed') {
    return this.jobRepo.update(id, {
      status,
      finished_at: new Date().toISOString(),
    })
  }
}
```

---

## `any` Elimination Plan

### Current `any` locations:

1. **`actions.ts:79`** — `rawEntries: any[]` → Use `AttioListEntry[]`
2. **`actions.ts:106`** — `rawEntries.map((e: any)` → Use typed `AttioListEntry`
3. **`actions.ts:113`** — `(arr[0] as any).value` → Use `Record<string, unknown>`
4. **`client.ts:16,35`** — Proxy `as any` → Keep (Proxy internals, unavoidable)
5. **`attioVal` function** — `first = arr[0] as any` → Use `Record<string, unknown>`
6. **`fetchAllAttioEntries`** — inline casts → Use typed `AttioListEntry`

### Strategy:
- Define `AttioListEntry` type in `packages/attio/src/types.ts`
- Replace all `any` with proper types or `unknown` + narrowing
- Keep `as any` in Proxy patterns only (2 occurrences in `client.ts`)

---

## Migration Strategy

### Phase 1: Foundation
- Create `packages/db/src/enums.ts` with runtime enums
- Create `packages/db/src/schemas.ts` with Zod schemas
- Update `types.ts` to use enums
- Add `zod` dependency

### Phase 2: Repository Layer
- Create `packages/db/src/repositories/` directory
- Split `queries.ts` into domain repositories
- Keep `queries.ts` as re-exports for backward compat during migration

### Phase 3: Attio API Client
- Create `packages/attio/` package
- Move all Attio fetch logic into `AttioClient` class
- Add proper types for Attio API responses

### Phase 4: Service Layer
- Create `apps/dashboard/src/services/`
- Move business logic from server actions into services
- Wire up DI container

### Phase 5: Controller Layer
- Refactor server actions to use Zod validation + services
- Add `requireAuth()` to every server action
- Remove all inline fetch calls

### Phase 6: Cleanup
- Remove `any` types
- Remove old `queries.ts` functions (replaced by repositories)
- Update component imports

---

## Security Checklist

- [x] **Supabase JS (PostgREST)** — parameterized queries via `.eq()`, `.ilike()` etc. No raw SQL injection risk
- [ ] **Auth checks** — add `requireAuth()` to every server action
- [ ] **Input validation** — add Zod schemas at controller boundaries
- [ ] **Attio API key** — already server-side only (env vars in server actions)
- [x] **No raw HTML rendering** — React's JSX handles escaping automatically; no unsafe HTML injection patterns present
- [ ] **Env var validation** — validate at container creation, fail fast with clear error
- [ ] **Rate limiting** — consider for Attio API calls (429 handling)

---

## Package Structure

```
packages/
  db/
    src/
      enums.ts          (NEW)
      schemas.ts         (NEW)
      types.ts           (UPDATED — use enums)
      client.ts          (UNCHANGED)
      queries.ts         (DEPRECATED — re-exports from repositories)
      repositories/
        lead-repository.ts
        client-repository.ts
        scrape-job-repository.ts
        call-log-repository.ts
        contact-repository.ts
        research-job-repository.ts
        lead-source-repository.ts
      index.ts           (UPDATED — export new modules)
  attio/                 (NEW PACKAGE)
    src/
      client.ts
      types.ts
      index.ts
    package.json
    tsconfig.json

apps/dashboard/src/
  lib/
    auth.ts              (NEW)
    container.ts         (NEW)
  services/
    lead-service.ts      (NEW)
    attio-sync-service.ts (NEW)
    scraper-service.ts   (NEW)
  app/
    leads/actions.ts     (REFACTORED)
    scraper/actions.ts   (REFACTORED)
```

---

## Key Decisions

1. **Supabase JS kept** (not pg.Pool) — stateless HTTP avoids connection exhaustion in serverless
2. **Constructor injection** — manual wiring via lazy Proxy singleton in `container.ts`
3. **Zod for validation** — `z.nativeEnum()` for enum validation, `safeParse` at boundaries
4. **Date normalization in repository layer** — consistent ISO format
5. **Attio types from codebase usage** (not full OpenAPI) — typed from actual field usage
6. **No breaking frontend changes** — services/repos are internal, server action signatures stay compatible
