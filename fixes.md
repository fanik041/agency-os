# Fixes Log — agency-os

_Last updated: 2026-05-13_

Resolved issues. Newest first. When closing a bug from `bugs.md`, copy the entry here with a "Resolved" date and a one-line explanation of the fix.

## 2026-05-13 (post-smoke session)

### Export only downloaded the first 100 rows
- **Symptom:** Clicking Export in the CRM toolbar downloaded a CSV with only ~100 rows even when the table showed 238 leads. Toast said "Export failed" with no detail.
- **Root cause:** `exportLeadsCrmCsvAction` passed `pageSize: 10000` through `listLeadsForCrmSchema.parse(...)`, but the schema caps `pageSize` at 500. Zod rejected the input and the action threw silently, which the client toasted as "Export failed". When export DID return, it returned only the first paged batch.
- **Fix:** Strip `page`/`pageSize` from the input before parsing the filter (so schema defaults apply), then loop `listForCrm` in batches of 500 until the dataset is exhausted (or 50k hard cap). Surface the row count + error in the toast.
- **Files:** `apps/dashboard/src/app/crm/actions.ts`, `apps/dashboard/src/components/crm/crm-toolbar.tsx`

### Created column showed unreadable ISO timestamps that wrapped badly
- **Symptom:** `Created` cell showed e.g. `2026-03-05T03:48:06.734269+00:00` wrapping into 3 lines, with `+00:00` clipped at the right edge.
- **Fix:** Added a `formatReadonly(value)` helper that detects ISO timestamps and renders `YYYY-MM-DD HH:mm`. Applied in the readonly cell renderer. Column shrunk from 170 to 140 px.
- **Files:** `apps/dashboard/src/components/crm/crm-table.tsx`, `apps/dashboard/src/lib/crm-columns.ts`

### Row checkbox floated in the middle of tall rows
- **Symptom:** When rows grew tall (wrapped long-text content), the leading checkbox sat vertically centered instead of aligned with the row's name text at the top.
- **Root cause:** The checkbox `<td>` lacked `align-top` (data cells had it). HTML default `vertical-align: middle` kicked in.
- **Fix:** Added `align-top` + `py-2 mt-1` to the checkbox td. Same treatment applied to the Actions td (AI button).
- **Files:** `apps/dashboard/src/components/crm/crm-table.tsx`

### Sticky pinned columns visually overlapped scrolled content (round 2)
- **Symptom:** Even after the first round of fixes, Status and Website columns appeared to stack at the same viewport x, with column widths squishing to fit content.
- **Root cause:** Table used `table-layout: auto`, which lets the browser stretch column widths based on content — so declared `width` attributes were treated as suggestions, not constraints. Long URLs stretched Website, crushing other columns and breaking the sticky `left:` calculations.
- **Fix:** Switched table to `table-layout: fixed` with an explicit `<colgroup>` of `<col>` widths. Table now uses an exact computed total width (no more `w-full + min-width`). Sticky-left offsets computed from VISIBLE pinned columns (handles hidden pinned cols correctly). Added a right-edge box-shadow on the rightmost pinned column for a visual divider.
- **Files:** `apps/dashboard/src/components/crm/crm-table.tsx`

### Column widths were too narrow for AI/pitch content
- **Symptom:** Pitch / Draft and Notes wrapped to many tall rows because columns were 240–400 px.
- **Fix:** Bumped widths — Pitch/Draft 400→560, Pain Points/Angle/AI Analysis 360→460, Website 320→360, Email 260→300, Address 360→400, Notes 320→380. Total table width ~5200 px (real horizontal scroll). Pinned region stays ~620 px on the left.
- **Files:** `apps/dashboard/src/lib/crm-columns.ts`

### AI fields hidden by default
- **Symptom:** Pain Points, Angle, Pitch/Draft, AI Analysis — the actual call ammo — were `defaultVisible: false`. Users had to manually toggle them on via the Columns menu.
- **Fix:** Flipped to `defaultVisible: true`. Reordered after Notes (logical reading order: notes → pain points → angle → pitch → AI analysis).
- **Files:** `apps/dashboard/src/lib/crm-columns.ts`

### Vercel build failed: `ERR_PNPM_OUTDATED_LOCKFILE`
- **Symptom:** Vercel `pnpm install --frozen-lockfile` failed because root `package.json` listed `eslint-scope` and `eslint-visitor-keys` in dependencies, but `pnpm-lock.yaml` didn't include them.
- **Root cause:** Two unused deps had been added to `package.json` without regenerating the lockfile. Neither was imported anywhere in source.
- **Fix:** Removed both lines from root `package.json`. Verified `pnpm install --frozen-lockfile` succeeds locally.
- **Files:** `package.json`

### CRM tab: pinned columns leaked scrolled content during horizontal scroll
- **Symptom:** Sticky columns (name/phone/status) appeared to overlap with right-side scrolled content — text from underlying cells was visible through inputs.
- **Root cause:** `<input>` elements inside sticky cells used `bg-transparent`, so the underlying scrolled-under cell showed through. Sticky `z-10` was also too low relative to default-z scrolled cells.
- **Fix:** All cell inputs/selects/buttons set to solid `bg-white` (not transparent). Bumped sticky cells to `z-20`/`z-30`. Added `bg-white` to all td cells (not just sticky) and used `group-hover:bg-[#fafbfc]` so row hover still applies uniformly.
- **Files:** `apps/dashboard/src/components/crm/{cell-text,cell-status,cell-long-text,crm-table}.tsx`

### CRM tab: text cells couldn't wrap, names truncated mid-word
- **Symptom:** "Habitual Fitness 8…" cut off; columns showed only first ~15 chars regardless of cell width.
- **Root cause:** Used single-line `<input>` for text fields — `<input>` is 1D and cannot wrap by design.
- **Fix:** Switched text-type cells to auto-resizing `<textarea>` (rows=1, height adjusts to scrollHeight on input). Long-text popover trigger also wraps by default with no truncation. Number cells stayed as `<input>`. Enter saves & blurs; Shift+Enter inserts newline; Escape reverts.
- **Files:** `apps/dashboard/src/components/crm/cell-text.tsx`, `cell-long-text.tsx`

### CRM tab: pagination missing
- **Symptom:** Could only ever see page 1. No way to navigate to subsequent pages or change page size.
- **Root cause:** `crm-client.tsx` read `?page=` from URL but never wrote it; hardcoded `pageSize: 100` in fetch with no UI.
- **Fix:** Added pagination footer with "Showing X–Y of Z" + per-page selector (50/100/200) + Prev/Next buttons. URL sync via `?page=` and `?per_page=` so views are bookmarkable. `safePage` clamps requested page to valid range when filters reduce result count.
- **Files:** `apps/dashboard/src/app/crm/crm-client.tsx`

### Pre-existing typecheck error after adding `Lead.deleted_at`
- **Symptom:** `apps/dashboard/src/services/lead-service.ts:49` failed with `Property 'deleted_at' is missing` after Task 2 added the field to the `Lead` type.
- **Root cause:** `lead-service.importLeads` builds a complete bulk-insert literal listing every column; adding a column requires updating this literal.
- **Fix:** Added `deleted_at: null` to the bulk-insert object. (Tracked separately as bug CRM-002 for proper refactor.)
- **Files:** `apps/dashboard/src/services/lead-service.ts`

### Dashboard had no `typecheck` script
- **Symptom:** `pnpm --filter @agency-os/dashboard typecheck` failed with "no script" — the plan assumed it existed.
- **Fix:** Added `"typecheck": "tsc --noEmit"` to `apps/dashboard/package.json` scripts. Same fix later applied to `apps/scraper-service/package.json`.
- **Files:** `apps/dashboard/package.json`, `apps/scraper-service/package.json`
