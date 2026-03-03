'use server'

import { createClient, updateClient, getLeadById, updateLeadStatus } from '@agency-os/db'
import type { Client } from '@agency-os/db'
import { revalidatePath } from 'next/cache'

export async function createClientAction(formData: FormData) {
  const data: Omit<Client, 'id' | 'created_at'> = {
    lead_id: (formData.get('lead_id') as string) || null,
    business_name: formData.get('business_name') as string,
    contact_name: (formData.get('contact_name') as string) || null,
    phone: (formData.get('phone') as string) || null,
    email: (formData.get('email') as string) || null,
    niche: (formData.get('niche') as string) || null,
    city: (formData.get('city') as string) || null,
    site_url: null,
    github_repo: null,
    vercel_project_id: null,
    deal_value: formData.get('deal_value') ? parseFloat(formData.get('deal_value') as string) : null,
    paid_upfront: 0,
    paid_final: 0,
    retainer_amount: 0,
    retainer_active: false,
    retainer_billing_day: null,
    site_status: 'building',
  }

  const { error } = await createClient(data)
  if (error) throw new Error(error.message)

  if (data.lead_id) {
    await updateLeadStatus(data.lead_id, 'closed')
  }

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function convertLeadToClientAction(leadId: string) {
  const { data: lead, error: leadError } = await getLeadById(leadId)
  if (leadError || !lead) throw new Error('Lead not found')

  const { error } = await createClient({
    lead_id: leadId,
    business_name: lead.name,
    contact_name: null,
    phone: lead.phone,
    email: lead.email,
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
    site_status: 'building',
  })
  if (error) throw new Error(error.message)

  await updateLeadStatus(leadId, 'closed')

  revalidatePath('/clients')
  revalidatePath('/leads')
}

export async function updateClientAction(id: string, formData: FormData) {
  const updates: Partial<Omit<Client, 'id' | 'created_at'>> = {
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
    site_status: (formData.get('site_status') as Client['site_status']) || 'building',
  }

  const { error } = await updateClient(id, updates)
  if (error) throw new Error(error.message)

  revalidatePath(`/clients/${id}`)
  revalidatePath('/clients')
}
