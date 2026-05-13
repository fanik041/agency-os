# CRM Tab — Design Spec

_Date: 2026-05-13_
_Status: Approved (brainstorm complete)_
_Scope: New `/crm` tab in dashboard + complete Attio rip-out_

## Goal

Replace the Attio CRM sync with a native, in-app spreadsheet view of leads. Admin uses this tab to scan, edit, filter, import, and bulk-manage all lead records without leaving agency-os.

## Non-goals

- Multi-user / per-operator data isolation. Admin-only.
- Real-time collaboration / presence.
- Sub-tabs for Contacts, Clients, Revenue. Those keep their existing pages.
- Two-way sync to any external system.
- Virtual scrolling / windowing in v1.

## Route & nav

- New route: `apps/dashboard/src/app/crm/page.tsx`
- Sidebar: insert `{ href: '/crm', label: 'CRM', icon: Table }` immediately after Leads in `apps/dashboard/src/components/sidebar.tsx`

## Data scope

Leads only. All ~22 fields previously synced to Attio (per `leadToAttioValues` in the old `attio-sync-service.ts`):

`name, website, phone, address, reviews_raw, pain_points, suggested_angle, message_draft, email_found, notes, has_booking, has_chat_widget, has_contact_form, pain_score, review_count, rating, analyze, status, follow_up_date, niche, city`

Plus `id`, `created_at`, `updated_at` displayed (read-only).

## View

- Single wide table, horizontal scroll
- Sticky left columns: **name, phone, status**
- Pagination: 100 rows/page, page-size selector (50 / 100 / 200)
- Toolbar (left → right): Search · Filter · Columns · Show Deleted · Export · + New · Import CSV
- Selection: checkbox column on the left; "select all on page" in header

## Editing model (hybrid)

| Field type | Cell behavior |
|---|---|
| Text (`name`, `website`, `phone`, `email_found`, `niche`, `city`, `address`, `notes`) | Click → in-cell input. Save on blur or Enter. |
| Numeric (`pain_score`, `review_count`, `rating`) | Click → in-cell number input with min/max validation matching DB constraints. |
| Boolean (`has_booking`, `has_chat_widget`, `has_contact_form`, `analyze`) | Checkbox in cell. Click toggles + saves. |
| Enum (`status`) | Inline dropdown showing all `LeadStatus` values. |
| Date (`follow_up_date`) | Click → opens row drawer (date pickers in cells are clunky). |
| Long text (`message_draft`, `suggested_angle`, `pain_points`, `reviews_raw`) | Cell shows truncated preview. Click → popover textarea with Save/Cancel. |
| Read-only (`id`, `created_at`, `updated_at`) | Display only, no click handler. |

### Save model

- **Optimistic UI:** cell updates immediately on edit
- **Debounce:** server action fires 500ms after last keystroke (text/numeric); immediately for booleans/enums
- **Errors:** toast notification + cell turns red; cell stays red until next successful edit
- **Conflict resolution:** last-write-wins (admin-only, no concurrent editors expected)

### Row drawer

- Reuses pattern from existing `call-logger-sheet.tsx`
- Opened via row "Edit" button (rightmost cell) or by clicking date / long-text cells (long-text uses popover instead — drawer reserved for date + multi-field edits)
- Contains all fields editable in one form, including `follow_up_date`
- Explicit Save / Cancel buttons

## Filters / sort / search

- **Sort:** click column header → asc/desc/clear cycle. Sort state in URL query param.
- **Per-column filter:** every column header has a filter icon → dropdown showing distinct values present in current dataset (after search applied). Multi-select. Filter state in URL query param.
- **Global search:** text input matches against `name`, `phone`, `email_found`, `website`, `city`, `niche`. Debounced 300ms. Search state in URL query param.

URL state lets admin bookmark and share filtered views.

## Column visibility

- "Columns" button in toolbar → checklist dropdown
- Hidden columns persist in `localStorage` (key: `crm.hiddenColumns`)
- "Reset to default" link inside the menu restores the full set

## Bulk actions

When 1+ rows selected, a contextual action bar appears above the table:

- **Delete selected** → confirm dialog → soft delete all → undo toast (5s)
- **Set status to…** → dropdown → applies to all selected → undo toast (5s)

## Creates

- "+ New" button → opens empty row drawer with required-field validation
- Required fields: `name` (everything else optional)
- On save, prepends new row to current page

## CSV import

- "Import CSV" button → file picker
- Expanded schema covering all CRM columns (round-trip safe — exporting a CSV and re-importing it must work):
  - All fields from the data scope above
  - `id` column optional; if present and matches existing lead, **update**; if absent or no match, **create**
- Header row required; column order flexible (matched by header name)
- Preview modal shows first 5 rows + validation errors before commit
- Schema lives in `packages/db/src/schemas.ts` as a new `importLeadsCrmSchema` (the existing `importLeadsSchema` keeps its narrower shape for the Leads page)

## Deletes (soft)

### Schema migration

Add to `leads` table:

```sql
ALTER TABLE leads ADD COLUMN deleted_at TIMESTAMPTZ NULL;
CREATE INDEX leads_deleted_at_idx ON leads(deleted_at) WHERE deleted_at IS NULL;
```

### Repository changes

- `LeadRepository.list()` and all read methods filter `WHERE deleted_at IS NULL` by default
- New `includeDeleted: boolean` parameter to opt in
- New `LeadRepository.softDelete(ids: string[])` sets `deleted_at = now()`
- New `LeadRepository.restore(ids: string[])` sets `deleted_at = NULL`

### UX

- Single delete: row "Delete" button → confirm dialog → soft delete → undo toast (5s)
- Bulk delete: same flow with selected ids
- "Show deleted" toolbar toggle → re-runs query with `includeDeleted: true`; soft-deleted rows render with reduced opacity + a Restore action in place of Edit

## Export CSV

- "Export" button → downloads CSV of the current view
- Respects active filters, search, sort, and column visibility
- File name: `leads-export-YYYY-MM-DD-HHMM.csv`

## Server actions

Extend `apps/dashboard/src/app/leads/actions.ts` (or split into `apps/dashboard/src/app/crm/actions.ts` if the file gets unwieldy):

- `listLeadsForCrm({ page, pageSize, search, sort, filters, includeDeleted })` — paginated, filtered, sorted
- `updateLeadField({ leadId, field, value })` — single-field update for inline edits; field name validated against an allowlist
- `bulkUpdateLeadsStatus({ leadIds, status })`
- `softDeleteLeads({ leadIds })`
- `restoreLeads({ leadIds })`
- `importLeadsCrm({ rows })` — uses new `importLeadsCrmSchema`
- `exportLeadsCsv(params)` — same params as `listLeadsForCrm` but returns CSV blob (no pagination)

All actions use the existing DI container and Zod schemas.

## Attio rip-out

Bundled in the same PR as the CRM tab — no point keeping a sync target nobody reads.

### Files to delete

- `packages/attio/` (entire package)
- `apps/dashboard/src/services/attio-sync-service.ts`
- `apps/dashboard/src/app/api/debug-attio/route.ts`
- `scripts/debug-attio-diff.ts`
- `apps/dashboard/src/components/leads/attio-viewer-button.tsx`
- `apps/dashboard/src/components/leads/update-attio-button.tsx`

### Files to edit

- `apps/dashboard/src/components/leads/leads-table.tsx` — remove Attio button imports + usage
- `apps/dashboard/src/components/leads/leads-client.tsx` — remove Attio button imports + usage
- `apps/dashboard/src/components/leads/call-logger-sheet.tsx` — remove Attio sync call
- `apps/dashboard/src/services/lead-service.ts` — remove Attio sync method
- `apps/dashboard/src/lib/container.ts` — remove Attio service registration
- `apps/dashboard/src/lib/limits.ts` — remove Attio-related limit checks
- `apps/scraper-service/src/index.ts` — remove post-write Attio sync call
- `apps/scraper-service/src/e2e.test.ts` — remove Attio assertions
- `packages/db/src/schemas.ts` — remove `updateSingleAttioEntrySchema`
- `packages/db/src/enums.ts` — remove `AttioSyncStatus`
- `packages/db/src/types.ts` — remove `attio_id`, `attio_sync_status` from `Lead` type
- `packages/db/src/queries.ts` — remove Attio-related queries
- `packages/db/src/repositories/lead-repository.ts` — remove `updateAttioSync`
- `apps/dashboard/package.json` — remove `@agency-os/attio` workspace dep
- `apps/scraper-service/package.json` — same if present
- `pnpm-workspace.yaml` — verify `packages/attio` is removed (it's likely covered by `packages/*`, so removing the dir is enough)

### Schema migration (Attio cleanup)

```sql
ALTER TABLE leads DROP COLUMN IF EXISTS attio_id;
ALTER TABLE leads DROP COLUMN IF EXISTS attio_sync_status;
```

### Env

- Remove `ATTIO_API_KEY` from `.env.example` and any docs
- User removes the secret from Vercel manually (not codeable)

## Dependencies

New:
- `@tanstack/react-table` — table primitives (sort, filter, pinning, column visibility)
- `papaparse` — CSV parsing for import (small, well-tested) and export

Removed:
- Whatever Attio-specific deps live in `packages/attio/package.json` (likely none beyond `node-fetch` or similar)

## Testing

### Playwright E2E (`apps/dashboard/e2e/crm.spec.ts`)

- Load `/crm`, verify ~100 lead rows render
- Inline edit a `name` cell → verify optimistic update + persistence on reload
- Inline edit triggers a server error (mocked) → verify toast + red cell
- Sort by `pain_score` desc → verify order
- Apply per-column filter on `status` → verify filtered count
- Bulk select 3 rows → bulk delete → verify undo restores them
- "+ New" → fill name → save → verify new row at top
- CSV import a 5-row file → verify all 5 appear
- Soft delete a lead → toggle "Show deleted" → verify it appears with Restore button → restore → verify it's back in the live view
- Export CSV → verify file downloads with correct columns

### Repository tests (`packages/db/src/repositories/lead-repository.test.ts`)

- `list()` excludes soft-deleted rows by default
- `list({ includeDeleted: true })` includes them
- `softDelete(ids)` sets `deleted_at` non-null
- `restore(ids)` sets `deleted_at` back to null

### Build verification

- `pnpm typecheck` passes (no surviving Attio imports)
- `pnpm build` passes
- `grep -r "attio\|Attio" apps packages` returns nothing

## Open risks / notes

- **Lead schema is wide.** ~22 columns side-scrolling will be visually busy. Column visibility + sticky pins mitigate this; the "Reset to default" hides nothing initially so admin can choose what to hide.
- **CSV round-trip with `id`.** Admin could accidentally overwrite leads by editing a `id`-included CSV. Import preview must show "X new, Y updated" counts before commit.
- **Soft-delete migration is destructive-adjacent.** Adding the column is safe, but verify Supabase backups before running. Migration is forward-only; rollback would just drop the column (no data loss because soft-deleted rows already had `deleted_at` set).
- **Performance at 10k+ leads.** Pagination at 100/page keeps the DOM small. Per-column filters compute distinct values from the current page's dataset, not the full table — if admin needs cross-page distinct values, that's a v2 enhancement (would need a separate `getDistinctValues(field)` action).
- **`tanstack/react-table` adds bundle weight** (~30KB gzipped). Acceptable for a power-user tab.

## Out of scope (deferred)

- Virtual scrolling
- Real-time updates (websockets / Supabase realtime)
- Per-user column visibility (we save to localStorage, not DB)
- Sub-tabs for Contacts / Clients / Revenue (their list pages stay)
- AI-powered bulk operations
- Audit log of edits

## Build sequence (preview — full plan to be written separately)

1. Schema migration: add `deleted_at`, drop `attio_id` / `attio_sync_status`
2. Repository: soft-delete methods + filter
3. Server actions for CRM read/edit/delete/restore/import/export
4. Base CRM page with TanStack Table + pagination + sticky cols
5. Inline edit + optimistic save + error surface
6. Long-text popover + status dropdown + row drawer
7. Toolbar: search + filters + columns + show deleted + export + new + import
8. Bulk actions
9. Attio rip-out (delete files, remove imports, drop columns from types)
10. Sidebar entry + smoke test
11. E2E + repo tests + typecheck + build green
