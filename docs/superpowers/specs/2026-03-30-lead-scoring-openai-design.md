# Lead Scoring Pipeline — Replace n8n with Direct OpenAI API

**Date:** 2026-03-30
**Status:** Approved
**Goal:** Replace the n8n lead scoring webhook with a direct OpenAI GPT-4.1-mini call in the scraper service, with SSE streaming logs in the dashboard.

---

## Context

The current lead scoring pipeline sends unscored leads to an n8n webhook, which:
1. Calls the scraper service `/analyze` endpoint for website signals
2. Sends signals to OpenAI for scoring
3. Updates Supabase with scores

This requires a paid n8n instance. The new pipeline eliminates n8n by calling OpenAI directly from the scraper service.

## Architecture

```
ScoreLeadsButton (click)
  -> POST /api/score/stream (Next.js SSE proxy)
    -> POST /score/stream (scraper service, SSE)
      -> For each unscored lead:
        1. analyzeWebsite(lead.website)     [existing, in analyzer.ts]
        2. scoreWithLLM(lead, signals)      [new, in scorer.ts]
        3. updateLead(id, scores)           [existing Supabase queries]
        4. Stream log events back to client
      <- SSE events: log | warn | error | scored | done
    <- Proxied SSE stream
  <- Log modal displays real-time progress
```

## New Files

### `apps/scraper-service/src/scorer.ts`

The LLM scoring module. Responsibilities:
- Build the analysis prompt from lead data + website signals
- Call OpenAI GPT-4.1-mini with structured JSON output
- Parse and validate the response
- Return typed `ScoreResult`

**Types:**

```typescript
interface RecommendedProduct {
  product: string
  why: string
  estimated_impact: string
  priority: 'high' | 'medium' | 'low'
}

interface ScoreResult {
  pain_score: number           // 1-9
  pain_points: string          // detailed analysis text
  revenue_leaks: string        // specific money-losing gaps
  recommended_products: RecommendedProduct[]
  suggested_angle: string      // single strongest pitch opener
  message_draft: string        // ready-to-send 2-3 sentence outreach
}

interface ScoreInput {
  name: string
  niche: string | null
  city: string | null
  website: string | null
  rating: number | null
  review_count: number
  signals: AnalyzeResult       // from analyzer.ts
}
```

### `apps/scraper-service/src/prompts/score-lead.ts`

The system and user prompt templates, separated from logic for maintainability.

**System prompt context document:**

```
You are an expert business consultant and digital marketing strategist
analyzing a local business's online presence. Your job is to identify
every gap in their digital strategy — things they are missing, things
that are costing them money, and specific products/services that would
solve their problems.

You specialize in:
- SEO auditing and optimization
- Lead retention and conversion systems
- Revenue recovery (missed calls, abandoned leads, no-shows)
- Marketing automation (SMS, email, retargeting)
- Review generation and reputation management
- Website UX and conversion rate optimization

Be specific and quantitative where possible. Don't give generic advice.
Reference the actual signals from their website analysis.
```

**User prompt template:**

```
Analyze this business and return a JSON object.

Business: {name}
Niche: {niche}
City: {city}
Website: {website}
Google Rating: {rating}/5 ({review_count} reviews)

Website Analysis Signals:
- Reachable: {reachable}
- Has SSL (HTTPS): {has_ssl}
- Mobile Friendly: {mobile_friendly}
- Page Load: {page_load_ms}ms
- Has Contact Form: {has_contact_form}
- Has Booking Widget: {has_booking}
- Has Chat Widget: {has_chat_widget}
- Has CTA: {has_cta}
- Phone on Site: {phone_on_site}
- Hours on Site: {hours_on_site}
- Has Social Proof: {has_social_proof}
- SEO Issues: {seo_issues}
- Tech Stack: {tech_stack}

Return JSON with these fields:

1. pain_score (integer 1-9, where 9 = most pain, needs the most help urgently)

2. pain_points (string) — Detailed analysis covering:
   - SEO gaps: what is missing, estimated organic traffic they are losing
   - Lead retention failures: no chatbot, no booking system, no forms means lost customers
   - Mobile experience issues if any
   - Trust and credibility gaps: no SSL, no social proof, no testimonials
   - Website performance issues if page load is slow

3. revenue_leaks (string) — Specific ways this business is losing money right now. Be concrete, e.g.:
   - "No missed-call text-back system: likely losing 5-10 potential customers per week"
   - "No online booking: customers who want to book after hours go to competitors"
   - "No review generation: only {review_count} reviews vs competitors with 200+"
   - "No appointment reminders: industry average 20% no-show rate costs $X/month"
   - "No retargeting: 97% of website visitors leave without converting"
   - "No email/SMS follow-up: warm leads going cold"

4. recommended_products (array of objects) — Specific products/services to pitch, each with:
   - product: name of the product/service
   - why: why this business specifically needs it based on the signals
   - estimated_impact: what improvement they can expect
   - priority: "high", "medium", or "low"

   Consider these product categories:
   - Website redesign or optimization
   - SEO package (on-page, local SEO, Google Business Profile)
   - Chatbot / live chat widget
   - Missed-call text-back system
   - Online booking / scheduling system
   - SMS marketing and automation
   - Review generation and management
   - Google Ads / PPC management
   - Social media management
   - Email marketing automation
   - CRM setup and integration
   - Reputation monitoring
   - Loyalty / referral program
   - Retargeting / remarketing campaigns

5. suggested_angle (string) — The single strongest opening pitch. Lead with their biggest, most painful gap.

6. message_draft (string) — A ready-to-send cold outreach message (2-3 sentences). Lead with their specific problem, then your solution. Be direct, not salesy.
```

### `apps/dashboard/src/app/api/score/stream/route.ts`

SSE proxy route — same pattern as `/api/research/stream` and `/api/scrape/stream`.
Proxies the SSE stream from the scraper service through to the client.

## Modified Files

### `apps/scraper-service/src/index.ts`

Add `POST /score/stream` SSE endpoint:
- Accepts `{ leadIds: string[] }` (optional — if empty, scores all unscored leads)
- For each lead:
  1. Fetch lead from Supabase
  2. Skip if already scored (pain_score not null)
  3. Call `analyzeWebsite(lead.website)` if website exists
  4. Call `scoreLead(lead, signals)` from scorer.ts
  5. Update Supabase: pain_score, pain_points, suggested_angle, message_draft, analyze (full JSON), status, and all website signal fields
  6. Emit SSE log events at each step
- Status update logic:
  - pain_score >= 6 -> 'needs_review'
  - pain_score >= 4 -> 'scoring'
  - pain_score < 4 -> 'skip'
- Skip conditions with specific log messages:
  - No website field -> skip, log: "Skipped '{name}': no website found"
  - Website unreachable (timeout) -> skip, log: "Skipped '{name}': website timed out ({url})"
  - Website blocked (403/401) -> skip, log: "Skipped '{name}': website blocked access ({url}, HTTP {status})"
  - Website not found (404) -> skip, log: "Skipped '{name}': website not found ({url})"
  - Website server error (5xx) -> skip, log: "Skipped '{name}': website server error ({url}, HTTP {status})"
  - Already scored (pain_score not null) -> skip, log: "Skipped '{name}': already scored ({pain_score}/9)"

### `apps/scraper-service/package.json`

Add dependency: `"openai": "^4.x"`

### `apps/dashboard/src/components/leads/score-leads-button.tsx`

Rewrite to use SSE log modal pattern (matching Attio sync / Research modal):
- Click opens modal immediately
- Connects to `/api/score/stream` SSE endpoint
- Displays real-time logs with color coding:
  - info (zinc) — status messages
  - success (green) — lead scored successfully
  - warn (yellow) — skipped leads
  - error (red) — failures
  - scored (emerald) — score result summary per lead
  - done (blue) — final summary
- Shows progress: X/Y leads scored, total pain scores, products recommended
- Close button when complete

### `.env.example`

Add `OPENAI_API_KEY=` entry.

## Database Fields Updated Per Lead

The scoring pipeline updates these Supabase columns:

| Field | Source | Description |
|---|---|---|
| `pain_score` | LLM | 1-9 score |
| `pain_points` | LLM | Detailed gap analysis |
| `suggested_angle` | LLM | Best pitch opener |
| `message_draft` | LLM | Ready-to-send outreach |
| `analyze` | LLM + analyzer | Full JSON (signals + LLM analysis combined) |
| `has_booking` | analyzer | Booking widget detected |
| `has_chat_widget` | analyzer | Chat widget detected |
| `has_contact_form` | analyzer | Contact form detected |
| `page_load_ms` | analyzer | Page load time |
| `mobile_friendly` | analyzer | Viewport meta tag |
| `has_ssl` | analyzer | HTTPS |
| `seo_issues` | analyzer | Missing title/meta/h1 |
| `has_cta` | analyzer | Call-to-action detected |
| `phone_on_site` | analyzer | Phone number on site |
| `hours_on_site` | analyzer | Business hours on site |
| `has_social_proof` | analyzer | Testimonials/reviews |
| `tech_stack` | analyzer | Detected technologies |
| `status` | scoring logic | new -> needs_review/scoring/skip |

All of these already sync to Attio via `leadToAttioValues()` — no Attio changes needed.

## Coding Standards

- All types defined in dedicated type files, no `any`
- Enums for status values, priority levels, log types
- Prompts in separate files under `prompts/` directory
- OpenAI response validated with Zod schema before use
- SSE event types as union type, not raw strings
- Error handling: per-lead errors don't stop the batch
- Environment variable validation at startup

## Environment Variables

```
# Required (new)
OPENAI_API_KEY=sk-...

# Existing (unchanged, kept in .env)
N8N_WEBHOOK_URL=...          # No longer used for scoring, kept for reference
SCRAPER_SERVICE_URL=...
SCRAPER_SECRET=...
```

## Cost Estimate

GPT-4.1-mini at ~$0.40/1M input tokens:
- ~800 tokens input per lead (prompt + signals)
- ~400 tokens output per lead (structured JSON response)
- 100 leads = ~80K input + 40K output = ~$0.05 total
