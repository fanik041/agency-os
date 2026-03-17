import { supabaseAdmin } from '../client'
import type { CallLog } from '../types'

export class CallLogRepository {
  async log(entry: Omit<CallLog, 'id' | 'called_at'>): Promise<CallLog> {
    const { data, error } = await supabaseAdmin.from('call_log').insert(entry).select().single()
    if (error) throw new Error(`Failed to log call: ${error.message}`)
    return data as CallLog
  }

  async getForLead(leadId: string): Promise<CallLog[]> {
    const { data, error } = await supabaseAdmin
      .from('call_log')
      .select('*')
      .eq('lead_id', leadId)
      .order('called_at', { ascending: false })
    if (error) throw new Error(`Failed to fetch call log: ${error.message}`)
    return data as CallLog[]
  }
}
