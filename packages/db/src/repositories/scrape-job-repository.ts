import { supabaseAdmin } from '../client'
import type { ScrapeJob } from '../types'

export class ScrapeJobRepository {
  async getAll(): Promise<ScrapeJob[]> {
    const { data, error } = await supabaseAdmin
      .from('scrape_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`Failed to fetch scrape jobs: ${error.message}`)
    return data as ScrapeJob[]
  }

  async create(job: Pick<ScrapeJob, 'niches' | 'location' | 'city' | 'max_per_niche' | 'with_emails'>): Promise<ScrapeJob> {
    const { data, error } = await supabaseAdmin
      .from('scrape_jobs')
      .insert({ ...job, status: 'queued' as const, leads_found: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create scrape job: ${error.message}`)
    return data as ScrapeJob
  }

  async update(id: string, updates: Partial<Omit<ScrapeJob, 'id' | 'created_at'>>): Promise<ScrapeJob> {
    const { data, error } = await supabaseAdmin.from('scrape_jobs').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update scrape job: ${error.message}`)
    return data as ScrapeJob
  }
}
