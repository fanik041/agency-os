'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { createClientSchema, updateClientSchema } from '@agency-os/db'
import { LeadStatus, SiteStatus } from '@agency-os/db'
import type { Client } from '@agency-os/db'

export async function createClientAction(formData: FormData) {
  await requireAuth()

  const parsed = createClientSchema.parse({
    lead_id: (formData.get('lead_id') as string) || null,
    business_name: formData.get('business_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    niche: (formData.get('niche') as string) || null,
    city: (formData.get('city') as string) || null,
    deal_value: formData.get('deal_value') ? parseFloat(formData.get('deal_value') as string) : null,
  })

  await container.clientRepo.create({
    ...parsed,
    site_url: null,
    github_repo: null,
    vercel_project_id: null,
    paid_upfront: 0,
    paid_final: 0,
    retainer_amount: 0,
    retainer_active: false,
    retainer_billing_day: null,
    site_status: SiteStatus.Building,
  } as Omit<Client, 'id' | 'created_at'>)

  if (parsed.lead_id) {
    await container.leadRepo.updateStatus(parsed.lead_id, LeadStatus.Closed)
  }

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function convertLeadToClientAction(leadId: string) {
  await requireAuth()
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (!uuidRegex.test(leadId)) throw new Error('Invalid lead ID')

  let lead
  try {
    lead = await container.leadRepo.getById(leadId)
  } catch {
    throw new Error('Lead not found')
  }

  await container.clientRepo.create({
    lead_id: leadId,
    business_name: lead.name,
    contact_name: null,
    phone: lead.phone,
    email: lead.email_found,
    niche: lead.niche,
    city: lead.city,
    site_url: null,
    github_repo: null,
    vercel_project_id: null,
    deal_value: null,
    paid_upfront: 0,
    paid_final: 0,
    retainer_amount: 0,
    retainer_active: false,
    retainer_billing_day: null,
    site_status: SiteStatus.Building,
  } as Omit<Client, 'id' | 'created_at'>)

  await container.leadRepo.updateStatus(leadId, LeadStatus.Closed)

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function updateClientAction(id: string, formData: FormData) {
  await requireAuth()

  const parsed = updateClientSchema.parse({
    id,
    business_name: formData.get('business_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    niche: (formData.get('niche') as string) || null,
    city: (formData.get('city') as string) || null,
    site_url: (formData.get('site_url') as string) || null,
    deal_value: formData.get('deal_value') ? parseFloat(formData.get('deal_value') as string) : null,
    paid_upfront: parseFloat(formData.get('paid_upfront') as string) || 0,
    paid_final: parseFloat(formData.get('paid_final') as string) || 0,
    retainer_amount: parseFloat(formData.get('retainer_amount') as string) || 0,
    retainer_active: formData.get('retainer_active') === 'on',
    retainer_billing_day: formData.get('retainer_billing_day')
      ? parseInt(formData.get('retainer_billing_day') as string, 10)
      : null,
    site_status: (formData.get('site_status') as string) || SiteStatus.Building,
  })

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, ...updates } = parsed
  await container.clientRepo.update(id, updates as Partial<Omit<Client, 'id' | 'created_at'>>)

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
}
