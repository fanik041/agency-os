'use server'

import { updateLeadStatus, logCall, bulkUpsertLeads, createLeadSource, updateLeadSourceCount } from '@agency-os/db'
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