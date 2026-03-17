import type { ScrapeJobRepository } from '@agency-os/db'
import type { ScrapeJobStatus } from '@agency-os/db'

export class ScraperService {
  constructor(
    private jobRepo: ScrapeJobRepository,
    private scraperServiceUrl: string,
    private scraperSecret?: string,
  ) {}

  async createJob(params: { niches: string[]; location: string; city: string; maxPerNiche: number; withEmails: boolean }) {
    return this.jobRepo.create({
      niches: params.niches,
      location: params.location,
      city: params.city,
      max_per_niche: params.maxPerNiche,
      with_emails: params.withEmails,
    })
  }

  async triggerScrape(params: {
    niches: string[]; location: string;
    maxPerNiche: number; withEmails: boolean;
  }): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.scraperSecret) {
      headers['Authorization'] = `Bearer ${this.scraperSecret}`
    }

    const resp = await fetch(`${this.scraperServiceUrl}/scrape`, {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    })
    if (!resp.ok) {
      const err = await resp.text().catch(() => `HTTP ${resp.status}`)
      throw new Error(`Scraper error: ${err}`)
    }
    return resp.json()
  }

  async triggerResearch(leadIds: string[]): Promise<unknown> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (this.scraperSecret) {
      headers['Authorization'] = `Bearer ${this.scraperSecret}`
    }

    const resp = await fetch(`${this.scraperServiceUrl}/research`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ leadIds }),
    })
    if (!resp.ok) {
      const err = await resp.text().catch(() => `HTTP ${resp.status}`)
      throw new Error(`Research error: ${err}`)
    }
    return resp.json()
  }

  async updateJobStatus(id: string, status: ScrapeJobStatus) {
    return this.jobRepo.update(id, {
      status,
      finished_at: new Date().toISOString(),
    })
  }
}
