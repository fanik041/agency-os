'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import {
  triggerResearchSchema, updateContactTagsSchema,
  updateContactNotesSchema, linkContactToLeadSchema,
} from '@agency-os/db'

export async function triggerResearchAction(leadIds: string[]) {
  await requireAuth()
  const parsed = triggerResearchSchema.parse({ leadIds })
  const result = await container.scraperService.triggerResearch(parsed.leadIds)
  revalidatePath('/contacts')
  return result
}

export async function updateContactTagsAction(contactId: string, tags: string[]) {
  await requireAuth()
  const parsed = updateContactTagsSchema.parse({ contactId, tags })
  await container.contactRepo.updateTags(parsed.contactId, parsed.tags)
  revalidatePath('/contacts')
}

export async function updateContactNotesAction(contactId: string, notes: string) {
  await requireAuth()
  const parsed = updateContactNotesSchema.parse({ contactId, notes })
  await container.contactRepo.update(parsed.contactId, { notes: parsed.notes })
  revalidatePath('/contacts')
}

export async function linkContactToLeadAction(contactId: string, leadId: string | null) {
  await requireAuth()
  const parsed = linkContactToLeadSchema.parse({ contactId, leadId })
  const data = await container.contactRepo.linkToLead(parsed.contactId, parsed.leadId)

  if (parsed.leadId) {
    const lead = await container.leadRepo.getById(parsed.leadId)
    if (lead?.niche) {
      const contact = data as { tags?: string[] }
      const currentTags: string[] = contact?.tags ?? []
      if (!currentTags.includes(lead.niche)) {
        await container.contactRepo.updateTags(parsed.contactId, [...currentTags, lead.niche])
      }
    }
  }

  revalidatePath('/contacts')
}
