import { supabaseAdmin } from '../client'
import type { LeadSource } from '../types'
import type { LeadSourceType } from '../enums'

export class LeadSourceRepository {
  async create(source: { type: LeadSourceType; label: string; scrape_job_id?: string | null }): Promise<LeadSource> {
    const { data, error } = await supabaseAdmin
      .from('lead_sources')
      .insert({ type: source.type, label: source.label, scrape_job_id: source.scrape_job_id ?? null, leads_count: 0 })
      .select()
      .single()
    if (error) throw new Error(`Failed to create lead source: ${error.message}`)
    return data as LeadSource
  }

  async updateCount(id: string, count: number): Promise<LeadSource> {
    const { data, error } = await supabaseAdmin
      .from('lead_sources')
      .update({ leads_count: count })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update lead source count: ${error.message}`)
    return data as LeadSource
  }
}
