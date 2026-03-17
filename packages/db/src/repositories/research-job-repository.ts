import { supabaseAdmin } from '../client'
import type { ResearchJob } from '../types'
import { ResearchJobStatus } from '../enums'

export class ResearchJobRepository {
  async getAll(): Promise<ResearchJob[]> {
    const { data, error } = await supabaseAdmin
      .from('research_jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw new Error(`Failed to fetch research jobs: ${error.message}`)
    return data as ResearchJob[]
  }

  async create(leadIds: string[]): Promise<ResearchJob> {
    const { data, error } = await supabaseAdmin
      .from('research_jobs')
      .insert({ status: ResearchJobStatus.Queued, lead_ids: leadIds, total: leadIds.length, processed: 0, contacts_found: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create research job: ${error.message}`)
    return data as ResearchJob
  }

  async update(id: string, updates: Partial<Omit<ResearchJob, 'id' | 'created_at'>>): Promise<ResearchJob> {
    const { data, error } = await supabaseAdmin.from('research_jobs').update(updates).eq('id', id).select().single()
    if (error) throw new Error(`Failed to update research job: ${error.message}`)
    return data as ResearchJob
  }
}
