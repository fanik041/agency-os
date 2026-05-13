'use server'

import { revalidatePath } from 'next/cache'
import { unstable_noStore } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import type { LeadStatus, CallOutcome } from '@agency-os/db'
import {
  updateLeadStatusSchema, logCallSchema, importLeadsSchema,
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

export async function checkScoringLimitAction() {
  console.log('[checkScoringLimit] Called')
  const user = await requireAuth()
  console.log(`[checkScoringLimit] User: ${user.id}`)
  const { checkLimit } = await import('@/lib/limits')
  const { UsageAction } = await import('@agency-os/db')
  const result = await checkLimit(user.id, UsageAction.Score)
  console.log(`[checkScoringLimit] Result:`, JSON.stringify(result))
  return result
}

