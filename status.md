# Project Status — agency-os

_Last updated: 2026-05-13_

## Summary

Turborepo (pnpm) monorepo for an agency lead-gen + outreach platform.

- **apps/dashboard** — Next.js 15 dashboard (auth, leads, **CRM**, clients, contacts, revenue, scraper, sites)
- **apps/scraper-service** — scraper / enricher / scorer / researcher pipeline
- **packages/** — `db`, `site-generator`, `ui`

External integrations: OpenAI (lead scoring + analysis), Google OAuth, n8n, Supabase. **Attio CRM removed 2026-05-13.**

## Current state

- Branch: `main` (last commit `bc33bc2 fixing scraper issue`, 2026-04-02)
- **Working tree heavily dirty** with the unpushed CRM-tab + Attio-removal session work — no commits made per user preference
- Two CRM migrations applied to Supabase (deleted_at added; attio_* columns dropped)
- Dev server runs clean; full `pnpm build` green; all typechecks green
- Vercel env still has `ATTIO_API_KEY` / `ATTIO_LIST_ID` — safe to delete manually

## Recent progress

### 2026-05-13 session
- **CRM tab shipped** (`/crm`): native spreadsheet view of leads. Inline edit (text auto-resize textarea, number, boolean, status dropdown), long-text popover, optimistic save + 500ms debounce + error toast/red cell, sortable headers, per-column filters (status/city/niche), column visibility menu (localStorage), bulk-select with bulk status update + bulk soft-delete with 5s undo toast, "Show deleted" toggle with restore, CSV import (round-trip safe with id column), CSV export of ALL matching rows (batched 500/page), "+ New" drawer
- **Attio fully removed**: `packages/attio/` deleted, all Attio source code stripped from dashboard + scraper-service + db package, `AttioSyncStatus` enum removed, `attio_*` DB columns dropped via migration
- **Per-row AI button** in Actions column (rightmost): one-click trigger of OpenAI scorer + pitch generator for that lead, auto-refreshes the row with the new `pain_score`/`pain_points`/`suggested_angle`/`message_draft`/`analyze` values
- **JSON cell type** for AI Analysis: collapsed-by-default chevron + summary, expand to pretty-printed JSON, edit-raw popover for manual overrides
- **Collapsible cell type** for Pain Points: 60-char preview → expand to full wrapped text → edit popover
- **Created column formatting**: ISO timestamps render as `YYYY-MM-DD HH:mm`
- New repository methods on `LeadRepository`: `softDelete`, `restore`, `listForCrm`, `updateField`, `bulkUpdateStatus`, `getDistinctValues` (TDD'd with 4 vitest tests, all green)
- New deps: `@tanstack/react-table`, `papaparse`, `@types/papaparse`
- New scripts: `scripts/apply-crm-migrations.js` (uses `pg` + `DATABASE_URL`; not used this session — user pasted SQL into Supabase Studio instead)
- Vercel build fix: removed unused `eslint-scope`/`eslint-visitor-keys` from root `package.json` that broke `pnpm install --frozen-lockfile`
- Post-smoke UX fixes (see `fixes.md` for full list): sticky-column overlap (z-index + solid bg), text wrapping (textarea swap), pagination footer, `table-layout: fixed` + colgroup, wider columns, checkbox align-top, export-all (was 100 only), AI fields visible by default

### Earlier (last ~25 commits before pause)
- Scraper bugfix, pitch generation, lead scoring + logging iterations + reset logic
- "Continue with Google" auth + bugfixes
- AI analysis feature on leads
- n8n integration: new buttons, more logging, export function
- DI container + Zod schemas refactor across actions (leads, scraper, clients, contacts, revenue)

## Open plans / specs (`docs/superpowers/`)

**Plans:**
- 2026-03-17 architecture refactoring
- 2026-03-30 auth google oauth
- 2026-03-30 lead scoring openai
- 2026-03-31 subscription tiers
- 2026-05-13 crm-tab ✅ implemented

**Specs:**
- 2026-03-17 architecture refactoring
- 2026-03-30 auth google oauth
- 2026-03-30 lead scoring openai
- 2026-03-30 meta ui theme
- 2026-03-31 attio portal — **OBSOLETE** (Attio removed)
- 2026-03-31 subscription tiers
- 2026-05-13 crm-tab ✅ implemented

## Next steps

1. Review the dirty working tree, commit, and push (Vercel will redeploy)
2. Delete `ATTIO_API_KEY` and `ATTIO_LIST_ID` from Vercel project env
3. Consider deleting the obsolete `2026-03-31-attio-portal-design.md` spec
4. Decide on the uncommitted root cleanup (xlsx files moved to untracked `Misc/`)
5. Pick up subscription tiers (spec + plan written, not implemented)
6. (Optional) Wire `DATABASE_URL` to enable the new `scripts/apply-crm-migrations.js` for future migrations

## Notes

- No external CRM sync. The native `/crm` tab is the source of truth for lead editing.
- This file is a living cache. Update when picking work back up or finishing a thread.
- See `bugs.md` for known issues. See `fixes.md` for resolved issues.
