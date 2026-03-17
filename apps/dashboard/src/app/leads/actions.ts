'use server'

import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import type { LeadStatus, CallOutcome } from '@agency-os/db'
import {
  updateLeadStatusSchema, logCallSchema, importLeadsSchema,
  updateSingleAttioEntrySchema,
} from '@agency-os/db'

export async function updateLeadStatusAction(leadId: string, status: LeadStatus, notes?: string) {
  await requireAuth()
  const parsed = updateLeadStatusSchema.parse({ leadId, status, notes })
  await container.leadService.updateStatus(parsed.leadId, parsed.status, parsed.notes)
  revalidatePath('/leads')
}

export async function logCallAction(
  leadId: string,
  outcome: CallOutcome,
  notes: string,
  durationSeconds: number | null
) {
  await requireAuth()
  const parsed = logCallSchema.parse({ leadId, outcome, notes, durationSeconds })
  const newStatus = container.leadService.outcomeToLeadStatus(parsed.outcome)

  await Promise.all([
    container.callLogRepo.log({
      lead_id: parsed.leadId,
      outcome: parsed.outcome,
      notes: parsed.notes || '',
      duration_seconds: parsed.durationSeconds,
    }),
    container.leadService.updateStatus(parsed.leadId, newStatus, parsed.notes || undefined),
  ])

  revalidatePath('/leads')
}

export async function fetchAttioEntriesAction() {
  await requireAuth()
  try {
    const result = await container.attioSyncService.fetchEntries()
    return { ok: true as const, ...result }
  } catch (err) {
    return { ok: false as const, error: String(err), entries: [] as { company_name: string; values: Record<string, unknown> }[] }
  }
}

export async function findMissingInAttioAction() {
  unstable_noStore()
  await requireAuth()
  try {
    const [leads, attioResult] = await Promise.all([
      container.leadRepo.getAll(),
      container.attioSyncService.fetchEntries(),
    ])
    const attioNames = new Set(
      attioResult.entries.map(e => e.company_name.toLowerCase().trim())
    )
    const missing = leads
      .filter(l => !attioNames.has(l.name.toLowerCase().trim()))
      .map(l => ({ id: l.id, name: l.name, address: l.address, website: l.website }))
    return { ok: true as const, supabaseCount: leads.length, attioCount: attioResult.entries.length, missing }
  } catch (err) {
    return { ok: false as const, error: String(err), supabaseCount: 0, attioCount: 0, missing: [] as { id: string; name: string; address: string | null; website: string | null }[] }
  }
}

export async function compareAttioAction() {
  unstable_noStore()
  await requireAuth()
  try {
    const result = await container.attioSyncService.compare()
    return { ok: true as const, ...result }
  } catch (err) {
    return { ok: false as const, error: String(err), diffs: [], newEntries: [], unchanged: 0, supabaseCount: 0, attioCount: 0 }
  }
}

export async function deduplicateAttioAction() {
  await requireAuth()
  try {
    return { ok: true as const, ...await container.attioSyncService.deduplicate() }
  } catch (err) {
    return { ok: false as const, error: String(err), duplicatesFound: 0, removed: 0, failed: 0 }
  }
}

export async function deduplicateLeadsAction() {
  await requireAuth()
  try {
    const result = await container.leadRepo.deduplicate()
    revalidatePath('/leads')
    return { ok: true as const, ...result }
  } catch (err) {
    return { ok: false as const, error: String(err), duplicatesFound: 0, merged: 0, deleted: 0, errors: [] as string[] }
  }
}

export async function updateSingleAttioEntryAction(entry: {
  leadId: string
  leadName: string
  recordId: string
  entryValues: Record<string, unknown>
  changedFields: string[]
}) {
  await requireAuth()
  const parsed = updateSingleAttioEntrySchema.parse(entry)
  return container.attioSyncService.syncEntry(parsed)
}

export async function createNewAttioEntryAction(entry: {
  leadId: string
  leadName: string
  domain?: string
  entryValues: Record<string, unknown>
}) {
  await requireAuth()
  return container.attioSyncService.createEntry(entry)
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
  await requireAuth()
  const parsed = importLeadsSchema.parse({ leads, fileName })
  const result = await container.leadService.importLeads(parsed.leads, parsed.fileName)
  revalidatePath('/leads')
  return result
}
