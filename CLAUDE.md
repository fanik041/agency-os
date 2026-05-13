# CLAUDE.md — agency-os

Project state lives in `status.md` (current branch state, recent progress, open plans, next steps). Read it at session start.

## Project shape

Turborepo (pnpm workspaces).

- `apps/dashboard` — Next.js dashboard (auth, leads, clients, contacts, revenue, scraper, sites)
- `apps/scraper-service` — scraper / enricher / scorer / researcher pipeline
- `packages/` — `attio` (CRM client), `db`, `site-generator`, `ui`

External: Attio CRM, OpenAI (lead scoring + analysis), Google OAuth, n8n, Supabase.

## Sources of truth

- `status.md` — latest project status (branch, progress, next steps)
- `docs/superpowers/plans/` — approved implementation plans
- `docs/superpowers/specs/` — design specs
- `packages/db/src/enums.ts` — runtime enums (don't use string literals)

## Coding standards

- TypeScript strict. No `any` outside narrow, justified spots.
- Server actions use **DI container** (`apps/dashboard/src/lib/container.ts`) and **Zod schemas** for input validation. Follow this pattern for new actions — it's how `leads/`, `scraper/`, `clients/`, `contacts/`, `revenue/` actions are written.
- Repository pattern via `packages/db/src/repositories/` — don't query directly from actions.
- Runtime enums from `packages/db/src/enums.ts` — don't use string literals.
- Default to no comments. Add only when WHY is non-obvious (constraint, invariant, workaround).
- Don't add backwards-compat shims, dead code, or speculative abstractions.
- Don't rewrite working code unless necessary — tweak existing.

## User Preferences

- No git commits unless explicitly asked.
- Full autonomy on implementation when given permission.
- Concise, actionable outputs over long explanations.

## Execution Rules (CRITICAL)

- Always start by checking `status.md` and `docs/` for latest progress before taking action.
- Do NOT scan the entire repo — use targeted discovery (LS, Grep, Glob) first, then Read.
- Never assume implementation — verify against code or docs.
- Prefer concise, actionable outputs over long explanations.

## Full-Stack Integrity

- Never rely on mock JSON or hardcoded data in shipped code.
- Always verify frontend → server action → repository → database flow.
- Ensure types in `packages/db/src/types.ts` match what UI consumes.
- Validate that UI reflects real data, not placeholders.
- If seed data is needed, generate realistic, ICP-aligned data (real-looking business names, scraped fields) — not dummy text.

## Testing

- Generate tests alongside code. Use `/e2e-testing-review` and Playwright for dashboard flows.
- Cover CRUD, edge cases, failure states (scraper failures, Attio sync failures, OpenAI timeouts).
- Validate auth flows: Google OAuth, session/token handling, Supabase JWT boundaries.
- Prefer integration + E2E over shallow unit tests. Pattern: `apps/scraper-service/src/e2e.test.ts`.

## Security

- Never expose secrets (Supabase service keys, OpenAI keys, Attio API keys, n8n webhook tokens) to the client.
- Validate all inputs on both frontend and server actions — use the existing Zod pattern.
- Enforce auth boundaries on every server action and API route. Don't trust client-supplied user/org IDs.
- Subscription tiers (planned): when payments land, never trust the client for plan state — verify via webhook.

## Marketing & Growth Awareness

- Think in terms of ICPs. Primary: **agency owners / operators** (dashboard users). Secondary: the **scraped lead businesses** being contacted.
- Prefer realistic, domain-specific seed data over generic placeholders.
- Optimize UI for the operator's core loop: scrape → score → pitch → sync → call.
- Highlight features that drive retention: AI analysis, scoring, pitch generation, n8n automation.

## UI Design

- Clean SaaS-style UI (Stripe / Linear / Notion level). Spacing and hierarchy over heavy borders.
- Maintain the design system in `packages/ui` — colors, typography, spacing.
- Save UI exploration / mockup outputs in `ui-design/`.

## Token Efficiency (CRITICAL)

- Don't read large files unless necessary. Grep/Glob first, then targeted Read.
- Summarize tool output, don't dump it back.
- Avoid redundant explanations. Action over verbosity.

## Skill Usage

- `sync-docs` — at session start, to load latest project context.
- `codebase-sync-planner` — before major refactors.
- `superpowers:brainstorming` — before any new feature or non-trivial design.
- `superpowers:writing-plans` — after a spec is approved, before code.
- `production-feature-builder` — for new features (subscription tiers, Attio portal).
- `superpowers:test-driven-development` — for any feature or bugfix implementation.
- `superpowers:systematic-debugging` — for any bug, test failure, or unexpected behavior.
- `e2e-testing-review` — after implementation.
- `fullstack-writing-validator` — before deployment, to verify real data wiring (no mocked JSON).
- `generate-ui-design` / `frontend-design` — for UI work; output to `ui-design/`.
