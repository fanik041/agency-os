'use server'

import { updateLeadStatus, logCall, bulkUpsertLeads, createLeadSource, updateLeadSourceCount } from '@agency-os/db'
import type { CallOutcome, CallStatus, Lead } from '@agency-os/db'
import { outcomeToStatus } from '@/lib/constants'
import { revalidatePath } from 'next/cache'

export async function updateLeadStatusAction(leadId: string, status: CallStatus, notes?: string) {
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
  const newStatus = outcomeToStatus(outcome)

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
  site_quality: number | null
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
    email: l.email,
    website: l.website,
    address: null,
    rating: null,
    review_count: 0,
    maps_url: null,
    city: l.city,
    has_website: !!l.website,
    site_quality: l.site_quality,
    call_status: 'pending' as const,
    call_notes: null,
    called_at: null,
    source_id: sourceId,
  }))

  const result = await bulkUpsertLeads(leadsToInsert)

  // Update the lead_source with actual count
  await updateLeadSourceCount(sourceId, result.inserted)

  revalidatePath('/leads')
  return result
}