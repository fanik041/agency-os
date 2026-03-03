import { supabaseAdmin } from './client'
import type { Lead, Client, ScrapeJob, CallLog, RevenueEvent, CallStatus, Contact, ResearchJob, LeadSourceType, LeadSource } from './types'

// LEADS
export async function getLeads(filters?: {
  city?: string
  niche?: string
  callStatus?: CallStatus
  minQuality?: number
  q?: string
  sourceId?: string
  page?: number
  perPage?: number
}) {
  const page = filters?.page ?? 1
  const perPage = filters?.perPage ?? 50
  const from = (page - 1) * perPage
  const to = from + perPage - 1

  let query = supabaseAdmin
    .from('leads')
    .select('*', { count: 'exact' })
    .order('site_quality', { ascending: false })

  if (filters?.city) query = query.eq('city', filters.city)
  if (filters?.niche) query = query.eq('niche', filters.niche)
  if (filters?.callStatus) query = query.eq('call_status', filters.callStatus)
  if (filters?.minQuality) query = query.gte('site_quality', filters.minQuality)
  if (filters?.q) query = query.ilike('name', `%${filters.q}%`)
  if (filters?.sourceId) query = query.eq('source_id', filters.sourceId)

  query = query.range(from, to)
  return query
}

// LEAD FILTER OPTIONS (distinct niches, cities, sources)
export async function getLeadFilterOptions() {
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

// LEAD SOURCES
export async function createLeadSource(source: {
  type: LeadSourceType
  label: string
  scrape_job_id?: string | null
}) {
  return supabaseAdmin
    .from('lead_sources')
    .insert({
      type: source.type,
      label: source.label,
      scrape_job_id: source.scrape_job_id ?? null,
      leads_count: 0,
    })
    .select()
    .single()
}

export async function updateLeadSourceCount(id: string, count: number) {
  return supabaseAdmin
    .from('lead_sources')
    .update({ leads_count: count })
    .eq('id', id)
    .select()
    .single()
}

export async function upsertLead(lead: Omit<Lead, 'id' | 'created_at'> & { id?: string }) {
  // Check if lead already exists by maps_url (no unique constraint on the column)
  if (lead.maps_url) {
    const { data: existing } = await supabaseAdmin
      .from('leads')
      .select('id')
      .eq('maps_url', lead.maps_url)
      .maybeSingle()
    if (existing) {
      return supabaseAdmin
        .from('leads')
        .update(lead)
        .eq('id', existing.id)
        .select()
        .single()
    }
  }
  return supabaseAdmin.from('leads').insert(lead).select().single()
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

// SINGLE RECORDS
export async function getClient(id: string) {
  return supabaseAdmin.from('clients').select('*, leads(name, niche, city)').eq('id', id).single()
}

export async function getLeadById(id: string) {
  return supabaseAdmin.from('leads').select('*').eq('id', id).single()
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

export async function getRevenueEventsForClient(clientId: string) {
  return supabaseAdmin
    .from('revenue_events')
    .select('*')
    .eq('client_id', clientId)
    .order('date', { ascending: false })
}

export async function getMRR() {
  const { data } = await supabaseAdmin
    .from('clients')
    .select('retainer_amount')
    .eq('retainer_active', true)
  return data?.reduce((sum, c) => sum + (c.retainer_amount || 0), 0) ?? 0
}

// BULK LEADS IMPORT
export async function bulkUpsertLeads(leads: Omit<Lead, 'id' | 'created_at'>[]) {
  const results: { inserted: number; updated: number; errors: string[] } = {
    inserted: 0,
    updated: 0,
    errors: [],
  }

  for (const lead of leads) {
    try {
      const { error } = await upsertLead({
        ...lead,
        call_status: lead.call_status || 'pending',
        call_notes: lead.call_notes || null,
        called_at: lead.called_at || null,
      })
      if (error) {
        results.errors.push(`${lead.name}: ${error.message}`)
      } else {
        results.inserted++
      }
    } catch (err) {
      results.errors.push(`${lead.name}: ${err}`)
    }
  }

  return results
}

// CONTACTS
export async function upsertContact(contact: Omit<Contact, 'id' | 'created_at'>) {
  const row = { ...contact, tags: contact.tags?.length ? contact.tags : [] }
  return supabaseAdmin.from('contacts').insert(row).select().single()
}

export async function updateContact(
  id: string,
  updates: Partial<Omit<Contact, 'id' | 'created_at'>>
) {
  return supabaseAdmin.from('contacts').update(updates).eq('id', id).select().single()
}

export async function updateContactTags(id: string, tags: string[]) {
  return supabaseAdmin.from('contacts').update({ tags }).eq('id', id).select().single()
}

export async function linkContactToLead(contactId: string, leadId: string | null) {
  return supabaseAdmin
    .from('contacts')
    .update({ lead_id: leadId })
    .eq('id', contactId)
    .select('*, leads(name, niche, city)')
    .single()
}

export async function getAllLeadsMinimal() {
  return supabaseAdmin
    .from('leads')
    .select('id, name, niche, city')
    .order('name', { ascending: true })
}

export async function getContactsForLead(leadId: string) {
  return supabaseAdmin
    .from('contacts')
    .select('*')
    .eq('lead_id', leadId)
    .order('confidence', { ascending: false })
}

export async function getAllContacts() {
  return supabaseAdmin
    .from('contacts')
    .select('*, leads(name, niche, city)')
    .order('created_at', { ascending: false })
}

// RESEARCH JOBS
export async function createResearchJob(leadIds: string[]) {
  return supabaseAdmin
    .from('research_jobs')
    .insert({
      status: 'queued' as const,
      lead_ids: leadIds,
      total: leadIds.length,
      processed: 0,
      contacts_found: 0,
    })
    .select()
    .single()
}

export async function updateResearchJob(
  id: string,
  updates: Partial<Omit<ResearchJob, 'id' | 'created_at'>>
) {
  return supabaseAdmin.from('research_jobs').update(updates).eq('id', id).select().single()
}

export async function getResearchJobs() {
  return supabaseAdmin
    .from('research_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
}
