export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { requireAuth } from '@/lib/auth'
import http from 'node:http'

export async function POST(req: Request) {
  await requireAuth()

  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  if (!scraperUrl) {
    return Response.json({ error: 'SCRAPER_SERVICE_URL is not configured' }, { status: 500 })
  }

  const body = await req.json()

  const reqHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SECRET) {
    reqHeaders['Authorization'] = `Bearer ${process.env.SCRAPER_SECRET}`
  }

  const target = new URL('/research/stream', scraperUrl)

  const upstream = await new Promise<http.IncomingMessage>((resolve, reject) => {
    const postData = JSON.stringify(body)
    const httpReq = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: 'POST',
        headers: { ...reqHeaders, 'Content-Length': Buffer.byteLength(postData) },
        timeout: 600_000,
      },
      (res) => resolve(res),
    )
    httpReq.on('error', reject)
    httpReq.on('timeout', () => httpReq.destroy(new Error('Connection timeout')))
    httpReq.write(postData)
    httpReq.end()
  })

  if (!upstream.statusCode || upstream.statusCode >= 400) {
    const chunks: Buffer[] = []
    for await (const chunk of upstream) chunks.push(chunk as Buffer)
    const text = Buffer.concat(chunks).toString()
    return Response.json({ error: text }, { status: upstream.statusCode || 500 })
  }

  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const encoder = new TextEncoder()

  ;(async () => {
    try {
      upstream.on('data', async (chunk: Buffer) => {
        try { await writer.write(encoder.encode(chunk.toString())) } catch { upstream.destroy() }
      })
      upstream.on('end', async () => {
        try { await writer.close() } catch { /* already closed */ }
      })
      upstream.on('error', async () => {
        try { await writer.close() } catch { /* already closed */ }
      })
    } catch {
      try { await writer.close() } catch { /* already closed */ }
    }
  })()

  return new Response(readable, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
