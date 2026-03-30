# Lead Scoring with OpenAI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the n8n lead scoring webhook with a direct OpenAI GPT-4.1-mini pipeline in the scraper service, with SSE streaming logs in the dashboard.

**Architecture:** The scraper service gets a new `POST /score/stream` SSE endpoint that fetches unscored leads, runs the existing `analyzeWebsite()` for each, sends the signals to OpenAI for business analysis, updates Supabase, and streams progress to the dashboard. The dashboard's ScoreLeadsButton is rewritten with a real-time log modal.

**Tech Stack:** OpenAI SDK (`openai`), Zod for response validation, Express SSE, existing Playwright analyzer, Supabase queries.

**Spec:** `docs/superpowers/specs/2026-03-30-lead-scoring-openai-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `apps/scraper-service/src/scorer.ts` | OpenAI client, prompt building, response parsing, `scoreLead()` function |
| `apps/scraper-service/src/types/scoring.ts` | All scoring types: ScoreInput, ScoreResult, RecommendedProduct, ScoringLogType enum |
| `apps/scraper-service/src/prompts/score-lead.ts` | System prompt and user prompt template functions |
| `apps/dashboard/src/app/api/score/stream/route.ts` | Next.js SSE proxy to scraper service |

### Modified Files
| File | Change |
|---|---|
| `apps/scraper-service/src/index.ts` | Add `POST /score/stream` SSE endpoint + `runScoringJob()` |
| `apps/scraper-service/package.json` | Add `openai` and `zod` dependencies |
| `apps/dashboard/src/components/leads/score-leads-button.tsx` | Full rewrite with SSE log modal |
| `packages/db/src/queries.ts` | Add `updateLeadScoring()` function |
| `packages/db/src/queries.ts` | Add `getUnscoredLeads()` function |
| `.env.example` | Add `OPENAI_API_KEY=` |

---

### Task 1: Add scoring types

**Files:**
- Create: `apps/scraper-service/src/types/scoring.ts`

- [ ] **Step 1: Create the types file**

```typescript
// apps/scraper-service/src/types/scoring.ts

import type { AnalyzeResult } from '../analyzer'

export enum ProductPriority {
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

export enum ScoringLogType {
  Info = 'info',
  Success = 'success',
  Warn = 'warn',
  Error = 'error',
  Scored = 'scored',
  Done = 'done',
}

export interface RecommendedProduct {
  product: string
  why: string
  estimated_impact: string
  priority: ProductPriority
}

export interface ScoreResult {
  pain_score: number
  pain_points: string
  revenue_leaks: string
  recommended_products: RecommendedProduct[]
  suggested_angle: string
  message_draft: string
}

export interface ScoreInput {
  name: string
  niche: string | null
  city: string | null
  website: string | null
  rating: number | null
  review_count: number
  signals: AnalyzeResult
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/scraper-service/src/types/scoring.ts
git commit -m "feat(scoring): add scoring types for OpenAI pipeline"
```

---

### Task 2: Add prompt templates

**Files:**
- Create: `apps/scraper-service/src/prompts/score-lead.ts`

- [ ] **Step 1: Create the prompts file**

```typescript
// apps/scraper-service/src/prompts/score-lead.ts

import type { ScoreInput } from '../types/scoring'

export const SCORING_SYSTEM_PROMPT = `You are an expert business consultant and digital marketing strategist analyzing a local business's online presence. Your job is to identify every gap in their digital strategy — things they are missing, things that are costing them money, and specific products/services that would solve their problems.

You specialize in:
- SEO auditing and optimization
- Lead retention and conversion systems
- Revenue recovery (missed calls, abandoned leads, no-shows)
- Marketing automation (SMS, email, retargeting)
- Review generation and reputation management
- Website UX and conversion rate optimization

Be specific and quantitative where possible. Don't give generic advice. Reference the actual signals from their website analysis.`

export function buildScoringUserPrompt(input: ScoreInput): string {
  const { name, niche, city, website, rating, review_count, signals } = input

  return `Analyze this business and return a JSON object.

Business: ${name}
Niche: ${niche ?? 'Unknown'}
City: ${city ?? 'Unknown'}
Website: ${website ?? 'None'}
Google Rating: ${rating != null ? `${rating}/5` : 'N/A'} (${review_count} reviews)

Website Analysis Signals:
- Reachable: ${signals.reachable}
- Has SSL (HTTPS): ${signals.has_ssl}
- Mobile Friendly: ${signals.mobile_friendly}
- Page Load: ${signals.page_load_ms != null ? `${signals.page_load_ms}ms` : 'N/A'}
- Has Contact Form: ${signals.has_contact_form}
- Has Booking Widget: ${signals.has_booking}
- Has Chat Widget: ${signals.has_chat_widget}
- Has CTA: ${signals.has_cta}
- Phone on Site: ${signals.phone_on_site}
- Hours on Site: ${signals.hours_on_site}
- Has Social Proof: ${signals.has_social_proof}
- SEO Issues: ${signals.seo_issues ?? 'None detected'}
- Tech Stack: ${signals.tech_stack ?? 'Unknown'}

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
   - "No review generation: only ${review_count} reviews vs competitors with 200+"
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

6. message_draft (string) — A ready-to-send cold outreach message (2-3 sentences). Lead with their specific problem, then your solution. Be direct, not salesy.`
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/scraper-service/src/prompts/score-lead.ts
git commit -m "feat(scoring): add LLM prompt templates for lead scoring"
```

---

### Task 3: Install dependencies and create scorer module

**Files:**
- Modify: `apps/scraper-service/package.json`
- Create: `apps/scraper-service/src/scorer.ts`

- [ ] **Step 1: Install openai and zod in the scraper service**

```bash
cd apps/scraper-service && npm install openai zod
```

- [ ] **Step 2: Create the scorer module**

```typescript
// apps/scraper-service/src/scorer.ts

import OpenAI from 'openai'
import { z } from 'zod'
import type { ScoreInput, ScoreResult } from './types/scoring'
import { ProductPriority } from './types/scoring'
import { SCORING_SYSTEM_PROMPT, buildScoringUserPrompt } from './prompts/score-lead'

const ScoreResultSchema = z.object({
  pain_score: z.number().int().min(1).max(9),
  pain_points: z.string(),
  revenue_leaks: z.string(),
  recommended_products: z.array(z.object({
    product: z.string(),
    why: z.string(),
    estimated_impact: z.string(),
    priority: z.enum([ProductPriority.High, ProductPriority.Medium, ProductPriority.Low]),
  })),
  suggested_angle: z.string(),
  message_draft: z.string(),
})

let openaiClient: OpenAI | null = null

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set')
    }
    openaiClient = new OpenAI({ apiKey })
  }
  return openaiClient
}

export async function scoreLead(input: ScoreInput): Promise<ScoreResult> {
  const client = getOpenAIClient()
  const userPrompt = buildScoringUserPrompt(input)

  const response = await client.chat.completions.create({
    model: 'gpt-4.1-mini',
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SCORING_SYSTEM_PROMPT },
      { role: 'user', content: userPrompt },
    ],
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    throw new Error('OpenAI returned empty response')
  }

  const parsed = JSON.parse(content)
  const validated = ScoreResultSchema.parse(parsed)
  return validated
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/scraper-service/package.json apps/scraper-service/package-lock.json apps/scraper-service/src/scorer.ts
git commit -m "feat(scoring): add OpenAI scorer module with Zod validation"
```

---

### Task 4: Add database query functions

**Files:**
- Modify: `packages/db/src/queries.ts`

- [ ] **Step 1: Add `getUnscoredLeads()` function**

Add after the existing `getUnsyncedLeads()` function (around line 121) in `packages/db/src/queries.ts`:

```typescript
export async function getUnscoredLeads() {
  return supabaseAdmin
    .from('leads')
    .select('*')
    .eq('status', LeadStatus.New)
    .is('pain_score', null)
    .order('created_at', { ascending: true })
}
```

- [ ] **Step 2: Add `updateLeadScoring()` function**

Add after `getUnscoredLeads()`:

```typescript
export async function updateLeadScoring(id: string, data: {
  pain_score: number
  pain_points: string
  suggested_angle: string
  message_draft: string
  analyze: string
  status: LeadStatus
  has_booking: boolean
  has_chat_widget: boolean
  has_contact_form: boolean
  page_load_ms: number | null
  mobile_friendly: boolean
  has_ssl: boolean
  seo_issues: string | null
  has_cta: boolean
  phone_on_site: boolean
  hours_on_site: boolean
  has_social_proof: boolean
  tech_stack: string | null
}) {
  return supabaseAdmin
    .from('leads')
    .update(data)
    .eq('id', id)
    .select()
    .single()
}
```

- [ ] **Step 3: Export the new functions**

Verify `packages/db/src/index.ts` already has `export * from './queries'` (it does — line 5). The new functions will be automatically exported.

- [ ] **Step 4: Commit**

```bash
git add packages/db/src/queries.ts
git commit -m "feat(db): add getUnscoredLeads and updateLeadScoring query functions"
```

---

### Task 5: Add POST /score/stream SSE endpoint to scraper service

**Files:**
- Modify: `apps/scraper-service/src/index.ts`

- [ ] **Step 1: Add imports at the top of index.ts**

Add to the existing import block at line 8 (after the existing imports from `@agency-os/db`):

```typescript
import { getUnscoredLeads, updateLeadScoring } from '@agency-os/db'
```

Add after the existing local imports (after line 16):

```typescript
import { scoreLead } from './scorer'
import type { ScoringLogType } from './types/scoring'
import { ScoringLogType as ScoringLogEnum } from './types/scoring'
```

- [ ] **Step 2: Add the /score/stream endpoint**

Insert after the closing `})` of the `POST /research/stream` endpoint (after line 495) and before `POST /analyze`:

```typescript
// ── POST /score/stream — SSE endpoint ─────────────────────────
app.post('/score/stream', authMiddleware, async (req, res) => {
  const { leadIds } = req.body

  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  })

  const send = (type: string, message: string, data?: unknown) => {
    const payload = JSON.stringify({ type, message, ...(data !== undefined ? { data } : {}) })
    res.write(`data: ${payload}\n\n`)
  }

  let disconnected = false
  req.on('close', () => { disconnected = true })

  const onLog = (type: string, message: string, data?: unknown) => {
    if (!disconnected) send(type, message, data)
  }

  await runScoringJob(leadIds ?? null, onLog)

  if (!disconnected) res.end()
})

async function runScoringJob(
  leadIds: string[] | null,
  onLog: (type: string, message: string, data?: unknown) => void,
) {
  let scored = 0
  let skipped = 0
  let failed = 0
  let totalProducts = 0

  const emit = (type: ScoringLogType, message: string, data?: unknown) => {
    onLog(type, message, data)
  }

  try {
    // Fetch leads to score
    let leads: Awaited<ReturnType<typeof getUnscoredLeads>>['data']

    if (leadIds && leadIds.length > 0) {
      // Score specific leads
      const results: NonNullable<typeof leads> = []
      for (const id of leadIds) {
        const { data } = await getLeadById(id)
        if (data) results.push(data)
      }
      leads = results
    } else {
      // Score all unscored leads
      const { data } = await getUnscoredLeads()
      leads = data
    }

    if (!leads || leads.length === 0) {
      emit(ScoringLogEnum.Done, 'No unscored leads found', { scored: 0, skipped: 0, failed: 0, totalProducts: 0 })
      return
    }

    const total = leads.length
    emit(ScoringLogEnum.Info, `Starting scoring for ${total} lead(s)...`)

    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i]
      const progress = `[${i + 1}/${total}]`

      try {
        // Check if already scored
        if (lead.pain_score != null) {
          emit(ScoringLogEnum.Warn, `${progress} Skipped "${lead.name}": already scored (${lead.pain_score}/9)`)
          skipped++
          continue
        }

        // Check if website exists
        if (!lead.website) {
          emit(ScoringLogEnum.Warn, `${progress} Skipped "${lead.name}": no website found`)
          await updateLeadStatus(lead.id, LeadStatus.Skip)
          skipped++
          continue
        }

        // Step 1: Analyze website
        emit(ScoringLogEnum.Info, `${progress} Analyzing website for "${lead.name}" (${lead.website})...`)
        const signals = await analyzeWebsite(lead.website)

        if (!signals.reachable) {
          // Determine specific skip reason
          const url = lead.website.startsWith('http') ? lead.website : `https://${lead.website}`
          let reason = 'website unreachable'
          try {
            const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) }).catch(() => null)
            if (resp) {
              if (resp.status === 403 || resp.status === 401) {
                reason = `website blocked access (HTTP ${resp.status})`
              } else if (resp.status === 404) {
                reason = `website not found (HTTP ${resp.status})`
              } else if (resp.status >= 500) {
                reason = `website server error (HTTP ${resp.status})`
              } else {
                reason = `website returned HTTP ${resp.status}`
              }
            } else {
              reason = 'website timed out or unreachable'
            }
          } catch {
            reason = 'website timed out or unreachable'
          }

          emit(ScoringLogEnum.Warn, `${progress} Skipped "${lead.name}": ${reason} (${lead.website})`)
          await updateLeadStatus(lead.id, LeadStatus.Skip)
          skipped++
          continue
        }

        emit(ScoringLogEnum.Info, `${progress} Website analyzed. Scoring with AI...`)

        // Step 2: Score with OpenAI
        const scoreResult = await scoreLead({
          name: lead.name,
          niche: lead.niche,
          city: lead.city,
          website: lead.website,
          rating: lead.rating,
          review_count: lead.review_count,
          signals,
        })

        // Determine status based on score
        let newStatus: LeadStatus
        if (scoreResult.pain_score >= 6) {
          newStatus = LeadStatus.NeedsReview
        } else if (scoreResult.pain_score >= 4) {
          newStatus = LeadStatus.Scoring
        } else {
          newStatus = LeadStatus.Skip
        }

        // Step 3: Update Supabase
        const analyzeJson = JSON.stringify({
          signals,
          scoring: {
            pain_score: scoreResult.pain_score,
            pain_points: scoreResult.pain_points,
            revenue_leaks: scoreResult.revenue_leaks,
            recommended_products: scoreResult.recommended_products,
            suggested_angle: scoreResult.suggested_angle,
            message_draft: scoreResult.message_draft,
          },
        })

        await updateLeadScoring(lead.id, {
          pain_score: scoreResult.pain_score,
          pain_points: scoreResult.pain_points,
          suggested_angle: scoreResult.suggested_angle,
          message_draft: scoreResult.message_draft,
          analyze: analyzeJson,
          status: newStatus,
          has_booking: signals.has_booking,
          has_chat_widget: signals.has_chat_widget,
          has_contact_form: signals.has_contact_form,
          page_load_ms: signals.page_load_ms,
          mobile_friendly: signals.mobile_friendly,
          has_ssl: signals.has_ssl,
          seo_issues: signals.seo_issues,
          has_cta: signals.has_cta,
          phone_on_site: signals.phone_on_site,
          hours_on_site: signals.hours_on_site,
          has_social_proof: signals.has_social_proof,
          tech_stack: signals.tech_stack,
        })

        totalProducts += scoreResult.recommended_products.length
        scored++

        emit(ScoringLogEnum.Scored, `${progress} "${lead.name}" — Score: ${scoreResult.pain_score}/9 | ${scoreResult.recommended_products.length} products | Status: ${newStatus}`, {
          name: lead.name,
          pain_score: scoreResult.pain_score,
          suggested_angle: scoreResult.suggested_angle,
          products: scoreResult.recommended_products.length,
        })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err)
        emit(ScoringLogEnum.Error, `${progress} Failed "${lead.name}": ${errMsg}`)
        failed++
      }
    }

    emit(ScoringLogEnum.Done, `Scoring complete — ${scored} scored, ${skipped} skipped, ${failed} failed, ${totalProducts} products recommended`, {
      scored,
      skipped,
      failed,
      totalProducts,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit(ScoringLogEnum.Error, `Fatal error: ${message}`)
  }
}
```

- [ ] **Step 3: Validate OPENAI_API_KEY at startup**

In `apps/scraper-service/src/index.ts`, find the existing startup validation block (around line 619):

```typescript
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
```

Change it to:

```typescript
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY']
```

- [ ] **Step 4: Update the health check endpoint to list /score/stream**

In the `app.get('/')` handler (around line 34), add to the endpoints object:

```typescript
'POST /score/stream': 'SSE stream — score leads with AI, returns real-time events',
```

- [ ] **Step 5: Commit**

```bash
git add apps/scraper-service/src/index.ts
git commit -m "feat(scoring): add POST /score/stream SSE endpoint with full scoring pipeline"
```

---

### Task 6: Add Next.js SSE proxy route

**Files:**
- Create: `apps/dashboard/src/app/api/score/stream/route.ts`

- [ ] **Step 1: Create the SSE proxy route**

```typescript
// apps/dashboard/src/app/api/score/stream/route.ts

export const dynamic = 'force-dynamic'

import { requireAuth } from '@/lib/auth'

export async function POST(req: Request) {
  await requireAuth()

  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  if (!scraperUrl) {
    return Response.json({ error: 'SCRAPER_SERVICE_URL is not configured' }, { status: 500 })
  }

  const body = await req.json()

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.SCRAPER_SECRET}`
  }

  const upstream = await fetch(`${scraperUrl}/score/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    return Response.json({ error: text }, { status: upstream.status })
  }

  if (!upstream.body) {
    return Response.json({ error: 'No stream body' }, { status: 500 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/app/api/score/stream/route.ts
git commit -m "feat(scoring): add Next.js SSE proxy route for /api/score/stream"
```

---

### Task 7: Rewrite ScoreLeadsButton with log modal

**Files:**
- Modify: `apps/dashboard/src/components/leads/score-leads-button.tsx`

- [ ] **Step 1: Rewrite the component**

Replace the entire file content:

```typescript
// apps/dashboard/src/components/leads/score-leads-button.tsx

'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type LogType = 'info' | 'success' | 'error' | 'warn' | 'done' | 'scored'

const colorMap: Record<LogType, string> = {
  info: 'text-zinc-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
  done: 'text-blue-400 font-bold',
  scored: 'text-emerald-400',
}

interface ScoringStats {
  scored: number
  skipped: number
  failed: number
  totalProducts: number
}

export function ScoreLeadsButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<{ text: string; type: LogType }[]>([])
  const [stats, setStats] = useState<ScoringStats | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((text: string, type: LogType = 'info') => {
    setLogs(prev => [...prev, { text, type }])
  }, [])

  async function handleScore() {
    if (startedRef.current) return
    startedRef.current = true
    setLoading(true)
    setLogs([])
    setStats(null)
    setOpen(true)

    addLog('Connecting to scoring pipeline...')

    try {
      const resp = await fetch('/api/score/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Request failed' }))
        addLog(`Error: ${err.error || resp.statusText}`, 'error')
        setLoading(false)
        startedRef.current = false
        return
      }

      if (!resp.body) {
        addLog('Error: No response stream', 'error')
        setLoading(false)
        startedRef.current = false
        return
      }

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n')
        buf = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const evt = JSON.parse(line.slice(6))
            const type = evt.type as string

            if (type === 'info') {
              addLog(evt.message, 'info')
            } else if (type === 'warn') {
              addLog(evt.message, 'warn')
            } else if (type === 'error') {
              addLog(evt.message, 'error')
            } else if (type === 'scored') {
              addLog(evt.message, 'scored')
            } else if (type === 'done') {
              addLog(evt.message, 'done')
              if (evt.data) {
                setStats({
                  scored: evt.data.scored,
                  skipped: evt.data.skipped,
                  failed: evt.data.failed,
                  totalProducts: evt.data.totalProducts,
                })
              }
            }
          } catch {
            // skip malformed SSE lines
          }
        }
      }
    } catch (err) {
      addLog(`Fatal error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setLoading(false)
      startedRef.current = false
      router.refresh()
    }
  }

  function handleClose() {
    setOpen(false)
  }

  const progressText = () => {
    if (loading && !stats) return 'Scoring leads with AI...'
    if (stats) {
      const parts = []
      if (stats.scored > 0) parts.push(`${stats.scored} scored`)
      if (stats.skipped > 0) parts.push(`${stats.skipped} skipped`)
      if (stats.failed > 0) parts.push(`${stats.failed} failed`)
      if (stats.totalProducts > 0) parts.push(`${stats.totalProducts} products recommended`)
      return parts.join(' | ')
    }
    return 'Done'
  }

  return (
    <>
      <Button onClick={handleScore} disabled={loading} size="sm" variant="outline">
        {loading ? 'Scoring...' : 'Score Leads'}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Scoring Leads with AI...' : 'Scoring Complete'}
            </DialogTitle>
            <DialogDescription>
              {progressText()}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-80 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {logs.map((entry, i) => (
              <div key={i} className={colorMap[entry.type]}>
                {entry.text}
              </div>
            ))}
            <div ref={logEndRef} />
          </div>

          {!loading && (
            <div className="flex justify-end pt-2">
              <Button size="sm" onClick={handleClose}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/dashboard/src/components/leads/score-leads-button.tsx
git commit -m "feat(scoring): rewrite ScoreLeadsButton with SSE log modal"
```

---

### Task 8: Update .env.example and add OPENAI_API_KEY to scraper .env

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add OPENAI_API_KEY to .env.example**

Add after the `SCRAPER_SECRET=` line:

```
# OpenAI (lead scoring)
OPENAI_API_KEY=
```

- [ ] **Step 2: Commit**

```bash
git add .env.example
git commit -m "feat(scoring): add OPENAI_API_KEY to .env.example"
```

---

### Task 9: Verify build and test

- [ ] **Step 1: Type-check the scraper service**

```bash
cd apps/scraper-service && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 2: Type-check the dashboard**

```bash
cd apps/dashboard && npx next build
```

Expected: Build succeeds with no errors.

- [ ] **Step 3: Verify the scraper service starts**

```bash
cd apps/scraper-service && npm run dev
```

Expected: `Scraper service running on port 3001` with no startup errors.

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(scoring): address build issues from scoring pipeline"
```
