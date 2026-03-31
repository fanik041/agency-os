export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { requireAuth } from '@/lib/auth'

export async function POST(req: Request) {
  console.log('[score] Route handler called')

  let userId: string
  try {
    const user = await requireAuth()
    userId = user.id
    console.log(`[score] Authenticated user: ${userId}`)
  } catch (err) {
    console.error('[score] Auth failed:', err)
    return Response.json({ error: 'Authentication failed' }, { status: 401 })
  }

  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  if (!scraperUrl) {
    return Response.json({ error: 'SCRAPER_SERVICE_URL is not configured' }, { status: 500 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    body = {}
  }
  console.log(`[score] Body:`, JSON.stringify(body))

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.SCRAPER_SECRET}`
  }

  console.log(`[score] Calling ${scraperUrl}/score/stream`)

  try {
    const upstream = await fetch(`${scraperUrl}/score/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })

    if (!upstream.ok) {
      const text = await upstream.text().catch(() => `HTTP ${upstream.status}`)
      console.error(`[score] Scraper error ${upstream.status}: ${text}`)
      return Response.json({ error: `Scraper error: ${text}` }, { status: upstream.status })
    }

    // Read the full SSE stream and parse events
    const text = await upstream.text()
    console.log(`[score] Received ${text.length} chars from scraper`)

    const lines = text.split('\n')
    let scored = 0
    let skipped = 0
    let failed = 0
    let totalProducts = 0
    const errors: string[] = []

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      try {
        const evt = JSON.parse(line.slice(6))
        console.log(`[score] Event: ${evt.type} — ${evt.message}`)

        if (evt.type === 'done' && evt.data) {
          scored = evt.data.scored ?? 0
          skipped = evt.data.skipped ?? 0
          failed = evt.data.failed ?? 0
          totalProducts = evt.data.totalProducts ?? 0
        } else if (evt.type === 'error') {
          errors.push(evt.message)
        }
      } catch {
        // skip malformed lines
      }
    }

    console.log(`[score] Complete — scored=${scored} skipped=${skipped} failed=${failed} products=${totalProducts}`)

    return Response.json({
      ok: true,
      scored,
      skipped,
      failed,
      totalProducts,
      errors,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[score] Failed: ${msg}`)
    return Response.json({ error: `Scoring failed: ${msg}` }, { status: 500 })
  }
}
