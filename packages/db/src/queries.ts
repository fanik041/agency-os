import { supabaseAdmin } from './client'
import type { Lead, Client, ScrapeJob, CallLog, RevenueEvent, CallStatus } from './types'

// LEADS
export async function getLeads(filters?: {
  city?: string
  niche?: string
  callStatus?: CallStatus
  minQuality?: number
}) {
  let query = supabaseAdmin.from('leads').select('*').order('site_quality', { ascending: false })
  if (filters?.city) query = query.eq('city', filters.city)
  if (filters?.niche) query = query.eq('niche', filters.niche)
  if (filters?.callStatus) query = query.eq('call_status', filters.callStatus)
  if (filters?.minQuality) query = query.gte('site_quality', filters.minQuality)
  return query
}

export async function upsertLead(lead: Omit<Lead, 'id' | 'created_at'> & { id?: string }) {
  return supabaseAdmin.from('leads').upsert(lead, { onConflict: 'maps_url' }).select().single()
}

export async function updateLeadStatus(id: string, status: CallStatus, notes?: string) {
  return supabaseAdmin
    .from('leads')
    .update({ call_status: status, call_notes: notes, called_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
}

// CLIENTS
export async function getClients() {
  return supabaseAdmin
    .from('clients')
    .select('*, leads(name, niche, city)')
    .order('created_at', { ascending: false })
}

export async function createClient(client: Omit<Client, 'id' | 'created_at'>) {
  return supabaseAdmin.from('clients').insert(client).select().single()
}

export async function updateClient(
  id: string,
  updates: Partial<Omit<Client, 'id' | 'created_at'>>
) {
  return supabaseAdmin.from('clients').update(updates).eq('id', id).select().single()
}

// SCRAPE JOBS
export async function createScrapeJob(
  job: Pick<ScrapeJob, 'niches' | 'location' | 'city' | 'max_per_niche' | 'with_emails'>
) {
  return supabaseAdmin
    .from('scrape_jobs')
    .insert({ ...job, status: 'queued' as const, leads_found: 0 })
    .select()
    .single()
}

export async function updateScrapeJob(
  id: string,
  updates: Partial<Omit<ScrapeJob, 'id' | 'created_at'>>
) {
  return supabaseAdmin.from('scrape_jobs').update(updates).eq('id', id).select().single()
}

export async function getScrapeJobs() {
  return supabaseAdmin
    .from('scrape_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
}

// CALL LOG
export async function logCall(entry: Omit<CallLog, 'id' | 'called_at'>) {
  return supabaseAdmin.from('call_log').insert(entry).select().single()
}

export async function getCallLogForLead(leadId: string) {
  return supabaseAdmin
    .from('call_log')
    .select('*')
    .eq('lead_id', leadId)
    .order('called_at', { ascending: false })
}

// REVENUE
export async function addRevenueEvent(event: Omit<RevenueEvent, 'id'>) {
  return supabaseAdmin.from('revenue_events').insert(event).select().single()
}

export async function getRevenueSummary() {
  return supabaseAdmin
    .from('revenue_events')
    .select('*, clients(business_name, retainer_active, retainer_amount)')
}

export async function getMRR() {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('retainer_amount')
    .eq('retainer_active', true)
  return data?.reduce((sum, c) => sum + (c.retainer_amount || 0), 0) ?? 0
}
