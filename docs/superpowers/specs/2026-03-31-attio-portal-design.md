# Attio Multi-Project Portal — Design Spec

**Date:** 2026-03-31
**Status:** Approved
**Goal:** Add an Attio portal section in the dashboard UI that displays Attio data in-app, and supports per-user Attio projects (lists). Current users share "Toronto Leads"; new users get their own project automatically.

**Depends on:** Auth (Sub-project 1), Subscription Tiers (Sub-project 2) — needs user_id and tier gating for Attio sync.

---

## Context

### Current State
- One shared Attio workspace with a single `ATTIO_LIST_ID`
- All leads sync to the same Attio list ("Toronto Leads")
- The `AttioViewerButton` shows all entries in a dialog — no dedicated page
- Attio API key and list ID are env vars shared across all users

### Target State
- A new `/attio` page in the dashboard that shows the user's Attio data in a rich table view
- Each user gets their own Attio list (project) automatically on first sync
- Admin users can view/manage all lists
- Attio data is browseable without leaving Agency OS

## New Database Table: `attio_projects`

Maps users to their Attio list.

```sql
create table attio_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  list_id text not null,
  list_name text not null,
  created_at timestamptz default now() not null,
  unique(user_id)
);

alter table attio_projects enable row level security;

create policy "Users can read own project"
  on attio_projects for select
  using (auth.uid() = user_id);

create policy "Service role full access"
  on attio_projects for all
  using (auth.role() = 'service_role');
```

### Seed for existing admin users

The existing admin users use the current `ATTIO_LIST_ID`:

```sql
-- Run after migration, manually for existing admins
insert into attio_projects (user_id, list_id, list_name)
select p.id, '<current ATTIO_LIST_ID value>', 'Toronto Leads'
from profiles p
where p.is_admin = true;
```

## Types

```typescript
// packages/db/src/types.ts
export interface AttioProject {
  id: string
  user_id: string
  list_id: string
  list_name: string
  created_at: string
}
```

## How Per-User Lists Work

### On first Attio sync for a new user:

1. Check if user has an `attio_projects` row
2. If not, create a new Attio list via the API:
   - `POST /v2/lists` with `name: "{user.full_name}'s Leads"` and `parent_object: "companies"`
   - Store the returned `list_id` in `attio_projects`
3. Use this list_id for all subsequent syncs

### For existing admin users:

- Already mapped to the existing list via seed data
- Continue using the shared "Toronto Leads" list

### AttioClient changes:

The `AttioClient` currently takes `listId` in its constructor. Change it to accept `listId` per-operation instead, so the same client can work with multiple lists:

```typescript
// Before
class AttioClient {
  constructor(private apiKey: string, private listId: string) {}
  fetchAllEntries() { /* uses this.listId */ }
}

// After
class AttioClient {
  constructor(private apiKey: string) {}
  fetchAllEntries(listId: string) { /* uses parameter */ }
  upsertEntry(listId: string, recordId: string, values: Record<string, unknown>) { ... }
  createList(name: string, parentObject: string): Promise<string> { ... }
}
```

## New Page: `/attio`

A dedicated Attio page in the sidebar navigation showing the user's Attio data.

### Layout

```
/attio
├── Header: "Attio" + project name badge + "Sync to Attio" button
├── Stats bar: Total entries, synced count, last sync time
├── Table: All entries from the user's Attio list
│   ├── Columns: Company Name, Website, Phone, Status, Pain Score, Niche, City, Synced At
│   ├── Sortable columns
│   ├── Search/filter
│   └── Click row → expand details (all fields)
└── Empty state: "No Attio data yet. Sync your leads to get started."
```

### Data flow

1. Page loads → fetch user's `attio_projects` row
2. If no project → show setup prompt ("Connect to Attio" button that creates a list)
3. If project exists → fetch entries from Attio API using the user's `list_id`
4. Display in table format with the same field mapping as `leadToAttioValues`

### Admin view

Admin users see a dropdown to switch between all users' Attio projects. This allows admins to view any user's Attio data.

## Sidebar Addition

Add "Attio" to the navigation items in `sidebar.tsx`:

```typescript
{ href: '/attio', label: 'Attio', icon: Database }  // or a suitable icon
```

Insert after "Revenue" in the nav order.

## New Files

| File | Responsibility |
|---|---|
| `supabase/migrations/004_add_attio_projects.sql` | attio_projects table, RLS |
| `packages/db/src/types.ts` | Add AttioProject interface |
| `packages/db/src/queries.ts` | Add attio_projects query functions |
| `apps/dashboard/src/app/attio/page.tsx` | Attio portal page (server component) |
| `apps/dashboard/src/app/attio/loading.tsx` | Loading skeleton |
| `apps/dashboard/src/components/attio/attio-table.tsx` | Client component for the entries table |
| `apps/dashboard/src/components/attio/attio-setup.tsx` | "Connect to Attio" setup component |

## Modified Files

| File | Change |
|---|---|
| `packages/attio/src/client.ts` | Accept listId per-method instead of constructor, add createList() method |
| `apps/dashboard/src/services/attio-sync-service.ts` | Use per-user list_id from attio_projects |
| `apps/dashboard/src/lib/container.ts` | Update AttioClient construction (no listId in constructor) |
| `apps/dashboard/src/components/sidebar.tsx` | Add Attio nav item |
| `apps/dashboard/src/app/leads/actions.ts` | Resolve user's list_id before Attio operations |
| `apps/dashboard/src/components/leads/update-attio-button.tsx` | Use user's list_id |
| `apps/dashboard/src/components/leads/attio-viewer-button.tsx` | Use user's list_id (or redirect to /attio page) |

## What doesn't change

- The Attio API key remains a shared env var (one workspace, multiple lists)
- The sync logic (compare, create, update) stays the same — just parameterized by list_id
- Lead data in Supabase is unaffected
- The field mapping (leadToAttioValues) stays identical
- Admin users keep their existing "Toronto Leads" list

## Tier Gating (from subscription spec)

- Free: Attio sync blocked, /attio page shows upgrade prompt
- Per Use: $1.00 per sync, /attio page accessible
- Pro/Enterprise: Free syncing, full /attio page access

## Future Considerations

- Attio webhooks for real-time sync (Attio → Supabase)
- Per-user Attio API keys (if users want to use their own Attio workspace)
- Bulk operations on the /attio page (delete, re-sync selected)
