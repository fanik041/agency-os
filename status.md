# Project Status — agency-os

_Last updated: 2026-05-13_

## Summary

Turborepo (pnpm) monorepo for an agency lead-gen + outreach platform.

- **apps/dashboard** — Next.js dashboard (auth, leads, clients, contacts, revenue, scraper, sites)
- **apps/scraper-service** — scraper / enricher / scorer / researcher pipeline
- **packages/** — `attio` (Attio CRM client), `db`, `site-generator`, `ui`

External integrations: Attio CRM, OpenAI (lead scoring + analysis), Google OAuth, n8n, Supabase.

## Current state

- Branch: `main`, up to date with `origin/main`
- Last commit: `bc33bc2 fixing scraper issue` (2026-04-02) — repo has been quiet for ~6 weeks
- Uncommitted: 10 deleted xlsx/csv/md files at root (lead trackers, pitches, calling guide), moved into untracked `Misc/` folder. Cleanup not yet committed.

## Recent progress (last ~25 commits)

- Scraper bugfix
- Pitch generation for leads
- Lead scoring + logging fixes (multiple iterations) and reset logic
- "Continue with Google" auth feature + bugfixes
- AI analysis feature on leads
- n8n integration: new buttons, more logging, export function
- Attio sync button bugfixes; place_id → address mapping
- DI container + Zod schemas refactor across actions (leads, scraper, clients, contacts, revenue)

## Open plans / specs (`docs/superpowers/`)

Plans:
- 2026-03-17 architecture refactoring
- 2026-03-30 auth google oauth
- 2026-03-30 lead scoring openai
- 2026-03-31 subscription tiers

Specs:
- 2026-03-17 architecture refactoring
- 2026-03-30 auth google oauth
- 2026-03-30 lead scoring openai
- 2026-03-30 meta ui theme
- 2026-03-31 attio portal
- 2026-03-31 subscription tiers

Subscription tiers and Attio portal specs exist but no commits yet reference shipping them — likely the next big threads.

## Next steps (suggested)

1. Decide on the uncommitted root cleanup (`Misc/` move) — commit or revert.
2. Pick up subscription tiers (spec + plan written, not implemented).
3. Pick up Attio portal (spec written).
4. Resume from the 6-week pause — re-verify dev/build still green before new work.

## Notes

- No `googleapis` / Google Sheets integration in the repo. Attio remains the CRM sync target.
- This file is a living cache. Update it when picking work back up or finishing a thread.
