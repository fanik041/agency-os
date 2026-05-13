# Known Bugs — agency-os

_Last updated: 2026-05-13_

Open issues. Move resolved items to `fixes.md` with date + brief explanation.

## Open

### CRM-001 — `attio-portal-design.md` spec is now obsolete
- **Severity:** docs cleanup
- **Where:** `docs/superpowers/specs/2026-03-31-attio-portal-design.md`
- **Symptom:** Spec describes an Attio integration that was removed in the 2026-05-13 session. Anyone reading the spec list will be misled.
- **Suggested fix:** Delete the file, or move it to a `docs/superpowers/specs/archived/` folder with a one-line README explaining why.

### CRM-002 — `lead-service.importLeads` still hardcodes legacy field defaults
- **Severity:** low (works, just brittle)
- **Where:** `apps/dashboard/src/services/lead-service.ts:30-46` — the bulk-insert literal lists every legacy column (`maps_url`, `site_quality`, `page_load_ms`, etc.) explicitly with nulls.
- **Symptom:** Any new column added to `Lead` requires also updating this literal, or typecheck breaks (already happened with `deleted_at` this session).
- **Suggested fix:** Widen `LeadRepository.bulkUpsert` to accept `Partial<Lead>` and let DB defaults fill the rest, or extract a `defaultLeadInsertShape()` helper.

### CRM-003 — `LeadRepository.upsert` has drifted from current `Lead` shape
- **Severity:** low (the `as never` casts in `crm/actions.ts` work around it)
- **Where:** `apps/dashboard/src/app/crm/actions.ts` `createLeadCrmAction` and `importLeadsCrmAction` use `as never` casts when calling `container.leadRepo.upsert(...)`.
- **Symptom:** TypeScript can't enforce that the upsert payload matches the current `Lead` shape — silent drift if `Lead` gains/loses fields.
- **Suggested fix:** Reshape `LeadRepository.upsert` to take `Partial<Omit<Lead, 'id' | 'created_at' | 'updated_at'>>` and let DB defaults fill the rest. Then drop the `as never`.

### CRM-004 — `importLeadsCrmAction` issues N×columns DB round-trips for updates
- **Severity:** performance, low priority (matters at high volume only)
- **Where:** `apps/dashboard/src/app/crm/actions.ts` import-update branch
- **Symptom:** When importing a CSV that updates existing rows, each non-null column triggers its own `updateField` call. A 1000-row × 10-column CSV = 10k round-trips.
- **Suggested fix:** Collapse into a single `update({...allFields}).eq('id', row.id)` per row, or bulk-update via `upsert`.

### CRM-005 — Status column filter chevron is a unicode glyph (⏷), hard to spot
- **Severity:** UX, low priority
- **Where:** `apps/dashboard/src/components/crm/column-filter.tsx`
- **Symptom:** Filter affordance is easy to miss; users may not realize columns are filterable.
- **Suggested fix:** Replace with a lucide-react icon (`Filter` / `ChevronDown`) and only color-fill when active.

### CRM-006 — Per-row AI button skips already-scored leads with no override
- **Severity:** feature gap, medium priority
- **Where:** `apps/dashboard/src/components/crm/score-row-button.tsx` → `/api/score/stream` → scraper-service
- **Symptom:** If a lead has already been scored, clicking "AI" just toasts "Skipped". No way to force a re-score (e.g. after the lead's website changed, or to try a different prompt).
- **Suggested fix:** Add a `force: true` flag to the API + scraper. UI: long-press / second click confirms re-score. Or surface as a dropdown next to the AI button.

### CRM-007 — Per-row AI button doesn't enforce tier limits
- **Severity:** correctness, low priority (admin bypass covers current users)
- **Where:** `apps/dashboard/src/components/crm/score-row-button.tsx`
- **Symptom:** Unlike `score-leads-button.tsx` which calls `checkScoringLimitAction` first, the per-row button does not. Admins pass through via `lib/limits.ts` admin bypass, but non-admin users would hit the limit without a friendly upsell screen.
- **Suggested fix:** Call `checkScoringLimitAction()` before the fetch; show the existing limit-denied modal pattern from `score-leads-button.tsx`.

### CRM-008 — `cell-json.tsx` falls back to "Invalid JSON" for prose fields
- **Severity:** UX nit
- **Where:** `apps/dashboard/src/components/crm/cell-json.tsx`
- **Symptom:** If a field declared `type: 'json'` happens to contain prose, the cell shows "⚠ Could not parse JSON" instead of rendering the prose nicely. Only matters if a field is mis-typed.
- **Suggested fix:** Either auto-fall-back to `CellCollapsible` rendering when JSON parse fails (cleanest), or document the column-type contract more strictly.

### MISC-001 — Untracked `Misc/` folder + 10 deleted xlsx/csv/md files at repo root
- **Severity:** repo hygiene
- **Where:** `git status` at repo root
- **Symptom:** Working tree has been dirty since at least 2026-04-02 with the file moves.
- **Suggested fix:** Decide whether to commit the move (`git add -A` + commit "chore: relocate lead trackers to Misc/") or revert.

### VERCEL-001 — `ATTIO_API_KEY` / `ATTIO_LIST_ID` still set in Vercel env
- **Severity:** cleanliness, low (no longer used by code)
- **Where:** Vercel project settings
- **Symptom:** Dead env vars; if someone re-introduces an Attio import, they'd hit live Attio without realizing.
- **Suggested fix:** Delete both from Vercel project env settings. Manual action — not codeable.

## Closed

See `fixes.md` for resolved issues.
