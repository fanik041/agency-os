'use server'

import { updateLeadStatus, logCall, bulkUpsertLeads, createLeadSource, updateLeadSourceCount, updateLeadAttioSync, getAllLeadsFull } from '@agency-os/db'
import type { CallOutcome, LeadStatus, Lead } from '@agency-os/db'
import { revalidatePath } from 'next/cache'

function outcomeToLeadStatus(outcome: CallOutcome): LeadStatus {
  switch (outcome) {
    case 'demo_booked': return 'booked'
    case 'closed': return 'closed'
    case 'not_interested': return 'skip'
    default: return 'sent'
  }
}

export async function updateLeadStatusAction(leadId: string, status: LeadStatus, notes?: string) {
  const { error } = await updateLeadStatus(leadId, status, notes)
  if (error) throw new Error(error.message)
  revalidatePath('/leads')
}

export async function logCallAction(
  leadId: string,
  outcome: CallOutcome,
  notes: string,
  durationSeconds: number | null
) {
  const newStatus = outcomeToLeadStatus(outcome)

  const [callResult, statusResult] = await Promise.all([
    logCall({ lead_id: leadId, outcome, notes: notes || null, duration_seconds: durationSeconds }),
    updateLeadStatus(leadId, newStatus, notes || undefined),
  ])

  if (callResult.error) throw new Error(callResult.error.message)
  if (statusResult.error) throw new Error(statusResult.error.message)

  revalidatePath('/leads')
}

export async function fetchAttioEntriesAction(): Promise<{
  ok: boolean
  error?: string
  workspace?: string
  listName?: string
  entries: { company_name: string; values: Record<string, unknown> }[]
}> {
  const apiKey = process.env.ATTIO_API_KEY
  const listId = process.env.ATTIO_LIST_ID

  console.log('[attio] fetchAttioEntries called, apiKey:', apiKey ? 'set' : 'missing', 'listId:', listId ?? 'missing')

  if (!apiKey || !listId) {
    return { ok: false, error: 'ATTIO_API_KEY and ATTIO_LIST_ID must be set', entries: [] }
  }

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  }

  try {
    // 1. Verify connection
    const selfResp = await fetch('https://api.attio.com/v2/self', { headers })
    if (!selfResp.ok) {
      return { ok: false, error: `Auth failed: HTTP ${selfResp.status}`, entries: [] }
    }
    const selfData = await selfResp.json()
    const workspace = selfData?.data?.workspace?.name ?? 'Unknown'
    console.log('[attio] Connected to workspace:', workspace)

    // 2. Get list name
    const listResp = await fetch(`https://api.attio.com/v2/lists/${listId}`, { headers })
    const listData = listResp.ok ? await listResp.json() : null
    const listName = listData?.data?.name ?? listId
    console.log('[attio] List name:', listName)

    // 3. Fetch all entries (paginate through all pages)
    const rawEntries: any[] = []
    let offset = 0
    const pageSize = 500

    while (true) {
      const entriesResp = await fetch(`https://api.attio.com/v2/lists/${listId}/entries/query`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ limit: pageSize, offset }),
      })

      if (!entriesResp.ok) {
        const errData = await entriesResp.json().catch(() => null)
        return { ok: false, error: `Failed to fetch entries: ${errData?.message ?? entriesResp.status}`, entries: [] }
      }

      const entriesData = await entriesResp.json()
      const page = entriesData?.data ?? []
      rawEntries.push(...page)
      console.log('[attio] Fetched page at offset', offset, '—', page.length, 'entries')

      if (page.length < pageSize) break
      offset += pageSize
    }

    console.log('[attio] Total entries fetched:', rawEntries.length)

    const entries = rawEntries.map((e: any) => {
      const vals = e.entry_values ?? {}
      const companyName = vals.company_name?.[0]?.value ?? vals.name?.[0]?.value ?? '(unnamed)'
      // Flatten each attribute to its first value for display
      const flat: Record<string, unknown> = {}
      for (const [key, arr] of Object.entries(vals)) {
        if (Array.isArray(arr) && arr.length > 0) {
          flat[key] = (arr[0] as any).value ?? (arr[0] as any).domain ?? JSON.stringify(arr[0])
        }
      }
      return { company_name: companyName, values: flat }
    })

    return { ok: true, workspace, listName, entries }
  } catch (err) {
    console.error('[attio] Error:', err)
    return { ok: false, error: `Connection failed: ${err instanceof Error ? err.message : err}`, entries: [] }
  }
}

const ATTIO_BASE = 'https://api.attio.com/v2'

const STATUS_MAP: Record<string, string> = {
  new: 'New', scoring: 'Scoring', needs_review: 'Needs Review',
  approved: 'Approved', sent: 'Sent', replied: 'Replied',
  booked: 'Booked', closed: 'Closed', skip: 'Skip',
}

function normalizeDomain(website: string | null): string | null {
  if (!website) return null
  const domain = website
    .replace(/https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/[?#].*$/, '')
    .replace(/:\d+/, '')
    .replace(/\/.*$/, '')
    .toLowerCase()
    .trim()
  return domain || null
}

/** Build the Attio entry_values object from a Supabase lead */
function leadToAttioValues(lead: Lead): Record<string, unknown> {
  const v: Record<string, unknown> = { company_name: lead.name }
  if (lead.website) v.website = lead.website
  if (lead.phone) v.phone = lead.phone
  if (lead.place_id) v.place_id = lead.place_id
  if (lead.reviews_raw) v.reviews_raw = lead.reviews_raw
  if (lead.pain_points) v.pain_points = lead.pain_points
  if (lead.suggested_angle) v.suggested_angle = lead.suggested_angle
  if (lead.message_draft) v.message_draft = lead.message_draft
  if (lead.email_found) v.email_found = lead.email_found
  if (lead.notes) v.notes = lead.notes
  v.has_booking = lead.has_booking
  v.has_chat_widget = lead.has_chat_widget
  v.has_contact_form = lead.has_contact_form
  if (lead.pain_score != null) v.pain_score = lead.pain_score
  // review_count + count: both are number fields in Attio
  if (lead.review_count != null && lead.review_count > 0) {
    v.review_count = lead.review_count
    v.count = lead.review_count
  }
  // rating_3 is the text field in Attio — send formatted like "4.8/5"
  if (lead.rating != null) v.rating_3 = `${lead.rating}/5`
  if (lead.analyze) v.analyze = lead.analyze
  if (lead.status && STATUS_MAP[lead.status]) v.status = STATUS_MAP[lead.status]
  if (lead.follow_up_date) v.follow_up_date = lead.follow_up_date
  if (lead.niche) v.niche = lead.niche
  if (lead.city) v.city = lead.city
  if (lead.address) v.address = lead.address
  if (lead.maps_url) v.maps_url = lead.maps_url
  return v
}

/** Extract scalar value from Attio's array-wrapped entry_values */
function attioVal(arr: unknown): unknown {
  if (!Array.isArray(arr) || arr.length === 0) return undefined
  const first = arr[0] as any
  if (first.value !== undefined) return first.value
  if (first.domain !== undefined) return first.domain
  if (first.option !== undefined) return first.option
  return undefined
}

export interface AttioDiffEntry {
  leadId: string
  leadName: string
  recordId: string
  diffs: string[]
  entryValues: Record<string, unknown>
}

/** Step 1: Compare Supabase leads with Attio entries, return the diff list */
export async function compareAttioAction(): Promise<{
  ok: boolean
  error?: string
  diffs: AttioDiffEntry[]
  unchanged: number
  unmatched: number
}> {
  const apiKey = process.env.ATTIO_API_KEY
  const listId = process.env.ATTIO_LIST_ID

  if (!apiKey || !listId) {
    return { ok: false, error: 'ATTIO_API_KEY and ATTIO_LIST_ID must be set', diffs: [], unchanged: 0, unmatched: 0 }
  }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  try {
    // Fetch all Attio entries
    console.log('[attio-compare] Fetching Attio entries...')
    const attioEntries: { recordId: string; name: string; values: Record<string, unknown> }[] = []
    let offset = 0
    while (true) {
      const resp = await fetch(`${ATTIO_BASE}/lists/${listId}/entries/query`, {
        method: 'POST', headers, body: JSON.stringify({ limit: 500, offset }),
      })
      if (!resp.ok) return { ok: false, error: `Failed to fetch Attio: HTTP ${resp.status}`, diffs: [], unchanged: 0, unmatched: 0 }
      const data = await resp.json()
      const page = data?.data ?? []
      for (const entry of page) {
        const vals = entry.entry_values ?? {}
        const name = vals.company_name?.[0]?.value ?? vals.name?.[0]?.value ?? ''
        const flat: Record<string, unknown> = {}
        for (const [key, arr] of Object.entries(vals)) {
          flat[key] = attioVal(arr)
        }
        attioEntries.push({ recordId: entry.parent_record_id, name, values: flat })
      }
      if (page.length < 500) break
      offset += 500
    }
    console.log('[attio-compare] Fetched', attioEntries.length, 'Attio entries')

    const attioByName = new Map<string, typeof attioEntries[number]>()
    for (const e of attioEntries) {
      if (e.name) attioByName.set(e.name.toLowerCase().trim(), e)
    }

    // Fetch all Supabase leads
    const { data: leads, error: dbError } = await getAllLeadsFull()
    if (dbError || !leads) return { ok: false, error: `DB error: ${dbError?.message}`, diffs: [], unchanged: 0, unmatched: 0 }
    console.log('[attio-compare] Fetched', leads.length, 'Supabase leads')

    const diffs: AttioDiffEntry[] = []
    let unchanged = 0
    let unmatched = 0

    for (const lead of leads) {
      const attioEntry = attioByName.get(lead.name.toLowerCase().trim())
      if (!attioEntry) { unmatched++; continue }

      const desired = leadToAttioValues(lead)
      const diffFields: string[] = []
      for (const [key, desiredVal] of Object.entries(desired)) {
        if (String(desiredVal ?? '') !== String(attioEntry.values[key] ?? '')) {
          diffFields.push(key)
        }
      }

      if (diffFields.length === 0) { unchanged++; continue }

      diffs.push({
        leadId: lead.id,
        leadName: lead.name,
        recordId: attioEntry.recordId,
        diffs: diffFields,
        entryValues: desired,
      })
    }

    console.log('[attio-compare] Result:', diffs.length, 'to update,', unchanged, 'unchanged,', unmatched, 'unmatched')
    return { ok: true, diffs, unchanged, unmatched }
  } catch (err) {
    return { ok: false, error: String(err), diffs: [], unchanged: 0, unmatched: 0 }
  }
}

/** Step 2: Update a single Attio entry (called from client in a loop) */
export async function updateSingleAttioEntryAction(entry: {
  leadId: string
  recordId: string
  entryValues: Record<string, unknown>
}): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.ATTIO_API_KEY
  const listId = process.env.ATTIO_LIST_ID
  if (!apiKey || !listId) return { ok: false, error: 'Missing env vars' }

  const headers = { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }

  // Log what we're sending for number fields
  console.log('[attio-update-single]', entry.entryValues.company_name,
    '| rating:', entry.entryValues.rating, typeof entry.entryValues.rating,
    '| review_count:', entry.entryValues.review_count, typeof entry.entryValues.review_count)

  try {
    const body = {
      data: { parent_record_id: entry.recordId, parent_object: 'companies', entry_values: entry.entryValues },
    }
    const resp = await fetch(`${ATTIO_BASE}/lists/${listId}/entries`, {
      method: 'PUT', headers,
      body: JSON.stringify(body),
    })

    const respData = await resp.json().catch(() => null)

    if (!resp.ok) {
      console.log('[attio-update-single] FAIL response:', JSON.stringify(respData))
      await updateLeadAttioSync(entry.leadId, 'failed').catch(() => {})
      return { ok: false, error: respData?.message ?? `HTTP ${resp.status}` }
    }

    // Log what Attio returned for the entry values to see if numbers stuck
    const returnedVals = respData?.data?.entry_values ?? {}
    console.log('[attio-update-single] Attio returned rating:', JSON.stringify(returnedVals.rating),
      '| review_count:', JSON.stringify(returnedVals.review_count))

    await updateLeadAttioSync(entry.leadId, 'synced').catch(() => {})
    return { ok: true }
  } catch (err) {
    await updateLeadAttioSync(entry.leadId, 'failed').catch(() => {})
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

interface ParsedLead {
  name: string
  niche: string | null
  phone: string | null
  email: string | null
  website: string | null
  pain_score: number | null
  city: string | null
}

export async function importLeadsAction(leads: ParsedLead[], fileName?: string) {
  if (!leads.length) throw new Error('No leads to import')

  // Create a lead_source to track this import batch
  const { data: source, error: sourceError } = await createLeadSource({
    type: 'import',
    label: fileName || `Import (${leads.length} leads)`,
  })

  if (sourceError || !source) {
    throw new Error(`Failed to create lead source: ${sourceError?.message}`)
  }

  const sourceId = source.id

  const leadsToInsert: Omit<Lead, 'id' | 'created_at'>[] = leads.map((l) => ({
    name: l.name,
    niche: l.niche,
    phone: l.phone,
    website: l.website,
    address: null,
    rating: null,
    review_count: 0,
    maps_url: null,
    place_id: null,
    city: l.city,
    has_website: !!l.website,
    site_quality: null,
    pain_score: l.pain_score,
    pain_points: null,
    suggested_angle: null,
    message_draft: null,
    email_found: l.email,
    has_booking: false,
    has_chat_widget: false,
    has_contact_form: false,
    reviews_raw: null,
    follow_up_date: null,
    notes: null,
    page_load_ms: null,
    mobile_friendly: null,
    has_ssl: null,
    seo_issues: null,
    has_cta: null,
    phone_on_site: null,
    hours_on_site: null,
    has_social_proof: null,
    tech_stack: null,
    analyze: null,
    status: 'new' as const,
    attio_sync_status: 'not_synced' as const,
    attio_synced_at: null,
    source_id: sourceId,
  }))

  const result = await bulkUpsertLeads(leadsToInsert)

  // Update the lead_source with actual count
  await updateLeadSourceCount(sourceId, result.inserted)

  revalidatePath('/leads')
  return result
}