import express from 'express'
import { createScrapeJob, updateScrapeJob, getScrapeJobs, upsertLead } from '@agency-os/db'
import { scrapeGoogleMaps, closeBrowser } from './scraper'
import { enrichBusiness } from './enricher'

const app = express()
app.use(express.json())

// ── Auth middleware ──────────────────────────────────────────────
const SCRAPER_SECRET = process.env.SCRAPER_SECRET

function authMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!SCRAPER_SECRET) return next() // No secret configured = open (dev mode)
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (token !== SCRAPER_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }
  next()
}

// ── Health check ────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok' }))

// ── POST /scrape ────────────────────────────────────────────────
// Starts a scraping job. Returns immediately with the job ID.
// Scraping runs in the background and updates Supabase in real time.
app.post('/scrape', authMiddleware, async (req, res) => {
  const { niches, location, city, maxPerNiche = 20, withEmails = false } = req.body

  if (!niches?.length || !location) {
    return res.status(400).json({ error: 'niches (array) and location (string) are required' })
  }

  // Create job in Supabase
  const { data: job, error } = await createScrapeJob({
    niches,
    location,
    city: city || location,
    max_per_niche: maxPerNiche,
    with_emails: withEmails,
  })

  if (error || !job) {
    return res.status(500).json({ error: 'Failed to create scrape job', detail: error?.message })
  }

  // Return job ID immediately
  res.json({ jobId: job.id, status: 'queued' })

  // Run scraping in background
  runScrapeJob(job.id, niches, location, city || location, maxPerNiche, withEmails)
})

// ── GET /jobs ───────────────────────────────────────────────────
app.get('/jobs', authMiddleware, async (_req, res) => {
  const { data, error } = await getScrapeJobs()
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// ── Background scrape runner ────────────────────────────────────
async function runScrapeJob(
  jobId: string,
  niches: string[],
  location: string,
  city: string,
  maxPerNiche: number,
  withEmails: boolean
) {
  let totalLeads = 0

  try {
    await updateScrapeJob(jobId, {
      status: 'running',
      started_at: new Date().toISOString(),
    })

    for (const niche of niches) {
      console.log(`[Job ${jobId}] Scraping "${niche}" in "${location}"...`)

      const businesses = await scrapeGoogleMaps(niche, location, maxPerNiche, async (business) => {
        // Real-time: enrich and upsert each lead as it's found
        try {
          const enriched = await enrichBusiness(business, withEmails)
          const { error } = await upsertLead({
            ...enriched,
            niche,
            city,
            call_status: 'pending',
            call_notes: null,
            called_at: null,
          })
          if (!error) {
            totalLeads++
            // Update leads_found count in real time
            await updateScrapeJob(jobId, { leads_found: totalLeads })
          } else {
            console.warn(`  Failed to upsert lead "${business.name}":`, error.message)
          }
        } catch (err) {
          console.warn(`  Failed to enrich lead "${business.name}":`, err)
        }
      })

      console.log(`  [Job ${jobId}] Found ${businesses.length} businesses for "${niche}"`)
    }

    await updateScrapeJob(jobId, {
      status: 'done',
      leads_found: totalLeads,
      finished_at: new Date().toISOString(),
    })
    console.log(`[Job ${jobId}] Complete — ${totalLeads} leads found`)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[Job ${jobId}] Failed:`, message)
    await updateScrapeJob(jobId, {
      status: 'failed',
      error_message: message,
      finished_at: new Date().toISOString(),
    })
  } finally {
    await closeBrowser()
  }
}

// ── Start server ────────────────────────────────────────────────
const PORT = process.env.PORT || 3001

// Validate env on startup
const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']
for (const key of required) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

app.listen(PORT, () => {
  console.log(`Scraper service running on port ${PORT}`)
  console.log(`Auth: ${SCRAPER_SECRET ? 'enabled' : 'disabled (dev mode)'}`)
})
