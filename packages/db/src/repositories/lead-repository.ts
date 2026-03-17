import { supabaseAdmin } from '../client'
import type { Lead, LeadSource } from '../types'
import type { LeadStatus, AttioSyncStatus } from '../enums'

export class LeadRepository {
  async getAll(): Promise<Lead[]> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return data as Lead[]
  }

  async getById(id: string): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('*')
      .eq('id', id)
      .single()
    if (error) throw new Error(`Lead not found: ${error.message}`)
    return data as Lead
  }

  async getPaginated(filters: {
    city?: string
    niche?: string
    status?: LeadStatus
    minPainScore?: number
    q?: string
    sourceId?: string
    page: number
    perPage: number
  }): Promise<{ data: Lead[]; count: number }> {
    const from = (filters.page - 1) * filters.perPage
    const to = from + filters.perPage - 1

    let query = supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact' })
      .order('pain_score', { ascending: false, nullsFirst: false })

    if (filters.city) query = query.eq('city', filters.city)
    if (filters.niche) query = query.eq('niche', filters.niche)
    if (filters.status) query = query.eq('status', filters.status)
    if (filters.minPainScore != null) query = query.gte('pain_score', filters.minPainScore)
    if (filters.q) query = query.ilike('name', `%${filters.q}%`)
    if (filters.sourceId) query = query.eq('source_id', filters.sourceId)

    query = query.range(from, to)
    const { data, count, error } = await query
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return { data: (data ?? []) as Lead[], count: count ?? 0 }
  }

  async getCount(): Promise<number> {
    const { count, error } = await supabaseAdmin
      .from('leads')
      .select('*', { count: 'exact', head: true })
    if (error) throw new Error(`Failed to count leads: ${error.message}`)
    return count ?? 0
  }

  async getMinimal(): Promise<{ id: string; name: string; niche: string | null; city: string | null }[]> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .select('id, name, niche, city')
      .order('name', { ascending: true })
    if (error) throw new Error(`Failed to fetch leads: ${error.message}`)
    return data as { id: string; name: string; niche: string | null; city: string | null }[]
  }

  async updateStatus(id: string, status: LeadStatus, notes?: string): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({ status, notes })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update lead status: ${error.message}`)
    return data as Lead
  }

  async updateAttioSync(id: string, syncStatus: AttioSyncStatus): Promise<Lead> {
    const { data, error } = await supabaseAdmin
      .from('leads')
      .update({
        attio_sync_status: syncStatus,
        attio_synced_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(`Failed to update sync status: ${error.message}`)
    return data as Lead
  }

  async upsert(lead: Omit<Lead, 'id' | 'created_at'> & { id?: string }): Promise<Lead> {
    if (lead.maps_url) {
      const { data: existing } = await supabaseAdmin
        .from('leads')
        .select('id')
        .eq('maps_url', lead.maps_url)
        .maybeSingle()
      if (existing) {
        const { data, error } = await supabaseAdmin
          .from('leads')
          .update(lead)
          .eq('id', existing.id)
          .select()
          .single()
        if (error) throw new Error(`Failed to update lead: ${error.message}`)
        return data as Lead
      }
    }
    const { data, error } = await supabaseAdmin.from('leads').insert(lead).select().single()
    if (error) throw new Error(`Failed to insert lead: ${error.message}`)
    return data as Lead
  }

  async bulkUpsert(leads: Omit<Lead, 'id' | 'created_at'>[]): Promise<{ inserted: number; updated: number; errors: string[] }> {
    const results = { inserted: 0, updated: 0, errors: [] as string[] }
    for (const lead of leads) {
      try {
        await this.upsert({ ...lead, status: lead.status || ('new' as LeadStatus), notes: lead.notes || null })
        results.inserted++
      } catch (err) {
        results.errors.push(`${lead.name}: ${err}`)
      }
    }
    return results
  }

  async getFilterOptions(): Promise<{ niches: string[]; cities: string[]; sources: LeadSource[] }> {
    const [nichesRes, citiesRes, sourcesRes] = await Promise.all([
      supabaseAdmin.from('leads').select('niche').not('niche', 'is', null),
      supabaseAdmin.from('leads').select('city').not('city', 'is', null),
      supabaseAdmin.from('lead_sources').select('*').order('created_at', { ascending: false }),
    ])
    const niches = [...new Set((nichesRes.data ?? []).map((r) => r.niche as string))]
    const cities = [...new Set((citiesRes.data ?? []).map((r) => r.city as string))]
    const sources = (sourcesRes.data ?? []) as LeadSource[]
    return { niches, cities, sources }
  }
}
