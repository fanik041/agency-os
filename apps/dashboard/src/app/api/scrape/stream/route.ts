export const dynamic = 'force-dynamic'
export const maxDuration = 900 // 15 minutes — enterprise tier

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

  const upstream = await fetch(`${scraperUrl}/scrape/stream`, {
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

  // Pipe the SSE stream through to the client
  return new Response(upstream.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
