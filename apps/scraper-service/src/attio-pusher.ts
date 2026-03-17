/**
 * Push leads from Agency OS DB to Attio CRM.
 * Maps Agency OS lead columns to Attio's "Toronto Leads" list schema.
 */

import { updateLeadAttioSync } from '@agency-os/db'

const ATTIO_BASE = 'https://api.attio.com/v2'

interface AttioConfig {
  apiKey: string
  listId: string
}

interface LeadForAttio {
  id: string
  name: string
  website: string | null
  phone: string | null
  place_id: string | null
  has_booking: boolean
  has_chat_widget: boolean
  has_contact_form: boolean
  reviews_raw: string | null
  review_count: number
  pain_score: number | null
  pain_points: string | null
  suggested_angle: string | null
  message_draft: string | null
  email_found: string | null
  status: string
  follow_up_date: string | null
  notes: string | null
  rating: number | null
  niche: string | null
  city: string | null
  address: string | null
  maps_url: string | null
  analyze: string | null
}

type LogFn = (type: 'log' | 'warn' | 'error' | 'success', message: string) => void

// Map DB status slugs to Attio select option titles
const STATUS_MAP: Record<string, string> = {
  new: 'New',
  scoring: 'Scoring',
  needs_review: 'Needs Review',
  approved: 'Approved',
  sent: 'Sent',
  replied: 'Replied',
  booked: 'Booked',
  closed: 'Closed',
  skip: 'Skip',
}

async function attioFetch(
  config: AttioConfig,
  path: string,
  method: string,
  body?: unknown,
  queryParams?: Record<string, string>
): Promise<{ ok: boolean; data?: any; error?: string }> {
  try {
    let url = `${ATTIO_BASE}${path}`
    if (queryParams) {
      const qs = new URLSearchParams(queryParams).toString()
      url += `?${qs}`
    }

    const resp = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    const data = await resp.json().catch(() => null)

    if (!resp.ok) {
      const msg = data?.message || data?.error || `HTTP ${resp.status}`
      return { ok: false, error: msg }
    }

    return { ok: true, data }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
}

/**
 * Push a single lead to Attio:
 * 1. Assert (upsert) a company record using domain as matching attribute
 * 2. Add the company to the Toronto Leads list with entry-level values
 */
async function pushLeadToAttio(
  config: AttioConfig,
  lead: LeadForAttio,
  log: LogFn
): Promise<boolean> {
  // Step 1: Assert company record
  const domain = lead.website
    ? lead.website.replace(/https?:\/\//, '').replace(/\/.*$/, '')
    : null

  const companyValues: Record<string, unknown> = {
    name: [{ value: lead.name }],
  }
  if (domain) {
    companyValues.domains = [{ domain }]
  }

  let companyResult
  if (domain) {
    companyResult = await attioFetch(
      config,
      '/objects/companies/records',
      'PUT',
      { data: { values: companyValues } },
      { matching_attribute: 'domains' }
    )
  } else {
    companyResult = await attioFetch(
      config,
      '/objects/companies/records',
      'POST',
      { data: { values: companyValues } }
    )
  }

  if (!companyResult.ok) {
    log('error', `Failed to create/update company "${lead.name}": ${companyResult.error}`)
    return false
  }

  const recordId = companyResult.data?.data?.id?.record_id
  if (!recordId) {
    log('error', `No record_id returned for "${lead.name}"`)
    return false
  }

  log('log', `Company record asserted: ${lead.name} (${recordId})`)

  // Step 2: Add to list with entry-level attribute values
  const entryValues: Record<string, unknown> = {}

  // Text fields
  entryValues.company_name = lead.name
  if (lead.website) entryValues.website = lead.website
  if (lead.phone) entryValues.phone = lead.phone
  if (lead.place_id) entryValues.place_id = lead.place_id
  if (lead.reviews_raw) entryValues.reviews_raw = lead.reviews_raw
  if (lead.pain_points) entryValues.pain_points = lead.pain_points
  if (lead.suggested_angle) entryValues.suggested_angle = lead.suggested_angle
  if (lead.message_draft) entryValues.message_draft = lead.message_draft
  if (lead.email_found) entryValues.email_found = lead.email_found
  if (lead.notes) entryValues.notes = lead.notes

  // Checkbox fields — boolean (non-nullable)
  entryValues.has_booking = lead.has_booking
  entryValues.has_chat_widget = lead.has_chat_widget
  entryValues.has_contact_form = lead.has_contact_form

  // Number fields
  if (lead.pain_score != null) entryValues.pain_score = lead.pain_score
  if (lead.review_count != null) entryValues.review_count = lead.review_count
  if (lead.rating != null) entryValues.rating = lead.rating

  // Analyze JSON blob (full /analyze response)
  if (lead.analyze) entryValues.analyze = lead.analyze

  // Select field — use the option title
  if (lead.status && STATUS_MAP[lead.status]) {
    entryValues.status = STATUS_MAP[lead.status]
  }

  // Date field
  if (lead.follow_up_date) entryValues.follow_up_date = lead.follow_up_date

  // Additional text fields
  if (lead.niche) entryValues.niche = lead.niche
  if (lead.city) entryValues.city = lead.city
  if (lead.address) entryValues.address = lead.address
  if (lead.maps_url) entryValues.maps_url = lead.maps_url

  const entryResult = await attioFetch(
    config,
    `/lists/${config.listId}/entries`,
    'PUT',
    {
      data: {
        parent_record_id: recordId,
        parent_object: 'companies',
        entry_values: entryValues,
      },
    }
  )

  if (!entryResult.ok) {
    log('error', `Failed to add/update "${lead.name}" in list: ${entryResult.error}`)
    return false
  }

  log('success', `Pushed "${lead.name}" to Attio`)
  return true
}

/**
 * Push multiple leads to Attio with streaming logs.
 */
export async function pushLeadsToAttio(
  leads: LeadForAttio[],
  apiKey: string,
  listId: string,
  log: LogFn
): Promise<{ pushed: number; failed: number; skipped: number }> {
  const config: AttioConfig = { apiKey, listId }
  const stats = { pushed: 0, failed: 0, skipped: 0 }

  log('log', `Starting push of ${leads.length} leads to Attio...`)

  for (let i = 0; i < leads.length; i++) {
    const lead = leads[i]
    log('log', `[${i + 1}/${leads.length}] Processing "${lead.name}"...`)

    const ok = await pushLeadToAttio(config, lead, log)
    if (ok) {
      stats.pushed++
      await updateLeadAttioSync(lead.id, 'synced').catch(() => {})
    } else {
      stats.failed++
      await updateLeadAttioSync(lead.id, 'failed').catch(() => {})
    }

    // Rate limit: 200ms between requests
    if (i < leads.length - 1) {
      await new Promise((r) => setTimeout(r, 200))
    }
  }

  log('log', `Done — ${stats.pushed} pushed, ${stats.failed} failed`)
  return stats
}
