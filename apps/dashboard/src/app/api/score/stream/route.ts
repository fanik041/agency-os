export const dynamic = 'force-dynamic'
export const maxDuration = 300 // 5 minutes — max for hobby plan, auto-resumes on timeout

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

  let upstream: Response
  try {
    upstream = await fetch(`${scraperUrl}/score/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[score/stream] Failed to connect to scraper service at ${scraperUrl}: ${message}`)
    return Response.json({ error: `Scraper service unreachable (${scraperUrl}): ${message}` }, { status: 502 })
  }

  if (!upstream.ok) {
    const text = await upstream.text().catch(() => `HTTP ${upstream.status}`)
    console.error(`[score/stream] Scraper returned ${upstream.status}: ${text}`)
    return Response.json({ error: `Scraper error (HTTP ${upstream.status}): ${text}` }, { status: upstream.status })
  }

  if (!upstream.body) {
    return Response.json({ error: 'No stream body returned from scraper service' }, { status: 500 })
  }

  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
