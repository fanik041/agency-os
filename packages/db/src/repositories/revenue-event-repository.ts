import { supabaseAdmin } from '../client'
import type { RevenueEvent } from '../types'

export class RevenueEventRepository {
  async add(event: Omit<RevenueEvent, 'id'>): Promise<RevenueEvent> {
    const { data, error } = await supabaseAdmin.from('revenue_events').insert(event).select().single()
    if (error) throw new Error(`Failed to add revenue event: ${error.message}`)
    return data as RevenueEvent
  }

  async getSummary() {
    const { data, error } = await supabaseAdmin
      .from('revenue_events')
      .select('*, clients(business_name, retainer_active, retainer_amount)')
    if (error) throw new Error(`Failed to fetch revenue summary: ${error.message}`)
    return data
  }

  async getForClient(clientId: string): Promise<RevenueEvent[]> {
    const { data, error } = await supabaseAdmin
      .from('revenue_events')
      .select('*')
      .eq('client_id', clientId)
      .order('date', { ascending: false })
    if (error) throw new Error(`Failed to fetch revenue events: ${error.message}`)
    return data as RevenueEvent[]
  }

  async getMRR(): Promise<number> {
    const { data } = await supabaseAdmin
      .from('clients')
      .select('retainer_amount')
      .eq('retainer_active', true)
    return data?.reduce((sum, c) => sum + (c.retainer_amount || 0), 0) ?? 0
  }
}
