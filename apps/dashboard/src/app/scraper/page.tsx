export const dynamic = 'force-dynamic'

import { getScrapeJobs } from '@agency-os/db'
import { ScrapeForm } from '@/components/scraper/scrape-form'
import { JobProgress } from '@/components/scraper/job-progress'

export default async function ScraperPage() {
  const { data: jobs } = await getScrapeJobs()

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Scraper</h1>
      <div className="grid gap-6 lg:grid-cols-2">
        <ScrapeForm />
        <JobProgress initialJobs={jobs ?? []} />
      </div>
    </div>
  )
}
