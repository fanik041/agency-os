'use server'

import { updateScrapeJob } from '@agency-os/db'
import { revalidatePath } from 'next/cache'

export async function triggerScrape(formData: FormData) {
  const nichesRaw = formData.get('niches') as string
  const location = formData.get('location') as string
  const maxPerNiche = parseInt(formData.get('maxPerNiche') as string, 10) || 20
  const withEmails = formData.get('withEmails') === 'on'

  const niches = nichesRaw
    .split(',')
    .map((n) => n.trim())
    .filter(Boolean)

  if (niches.length === 0 || !location) {
    throw new Error('Niches and location are required')
  }

  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  if (!scraperUrl) {
    throw new Error('SCRAPER_SERVICE_URL is not configured')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.SCRAPER_SECRET}`
  }

  const res = await fetch(`${scraperUrl}/scrape`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ niches, location, maxPerNiche, withEmails }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Scraper error: ${text}`)
  }

  revalidatePath('/scraper')
  return res.json()
}

export async function updateJobStatusAction(jobId: string, status: 'done' | 'failed') {
  const { error } = await updateScrapeJob(jobId, {
    status,
    finished_at: new Date().toISOString(),
  })
  if (error) throw new Error(error.message)
  revalidatePath('/scraper')
}
