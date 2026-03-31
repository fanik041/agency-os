export const dynamic = 'force-dynamic'
export const maxDuration = 300

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

  const upstream = await fetch(`${scraperUrl}/research/stream`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })

  if (!upstream.ok) {
    const text = await upstream.text()
    return Response.json({ error: text }, { status: upstream.status })
  }

  const upstreamReader = upstream.body?.getReader()
  if (!upstreamReader) {
    return Response.json({ error: 'No stream body' }, { status: 500 })
  }

  const stream = new ReadableStream({
    async pull(controller) {
      try {
        const { done, value } = await upstreamReader.read()
        if (done) { controller.close(); return }
        controller.enqueue(value)
      } catch {
        controller.close()
      }
    },
    cancel() {
      upstreamReader.cancel().catch(() => {})
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    },
  })
}
