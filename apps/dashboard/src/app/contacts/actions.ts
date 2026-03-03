'use server'

import { updateContactTags, updateContact, linkContactToLead, getLeadById } from '@agency-os/db'
import { revalidatePath } from 'next/cache'

export async function triggerResearchAction(leadIds: string[]) {
  if (leadIds.length === 0) {
    throw new Error('No leads selected')
  }

  const scraperUrl = process.env.SCRAPER_SERVICE_URL
  if (!scraperUrl) {
    throw new Error('SCRAPER_SERVICE_URL is not configured')
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (process.env.SCRAPER_SECRET) {
    headers['Authorization'] = `Bearer ${process.env.SCRAPER_SECRET}`
  }

  const res = await fetch(`${scraperUrl}/research`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ leadIds }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Research error: ${text}`)
  }

  revalidatePath('/contacts')
  return res.json()
}

export async function updateContactTagsAction(contactId: string, tags: string[]) {
  const { error } = await updateContactTags(contactId, tags)
  if (error) throw new Error(error.message)
  revalidatePath('/contacts')
}

export async function updateContactNotesAction(contactId: string, notes: string) {
  const { error } = await updateContact(contactId, { notes })
  if (error) throw new Error(error.message)
  revalidatePath('/contacts')
}

export async function linkContactToLeadAction(contactId: string, leadId: string | null) {
  const { data, error } = await linkContactToLead(contactId, leadId)
  if (error) throw new Error(error.message)

  // Auto-add niche as tag when linking to a lead
  if (leadId) {
    const { data: lead } = await getLeadById(leadId)
    if (lead?.niche) {
      const contact = data as { tags?: string[] }
      const currentTags: string[] = contact?.tags ?? []
      if (!currentTags.includes(lead.niche)) {
        await updateContactTags(contactId, [...currentTags, lead.niche])
      }
    }
  }

  revalidatePath('/contacts')
}
