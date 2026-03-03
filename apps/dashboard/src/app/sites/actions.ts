'use server'

import { generateSite } from '@agency-os/site-generator'
import type { GenerateSiteInput } from '@agency-os/site-generator'
import { revalidatePath } from 'next/cache'

export async function deploySiteAction(formData: FormData) {
  const input: GenerateSiteInput = {
    clientId: formData.get('clientId') as string,
    niche: formData.get('niche') as string,
    businessName: formData.get('businessName') as string,
    phone: formData.get('phone') as string,
    email: formData.get('email') as string,
    contactEmail: formData.get('contactEmail') as string,
    city: formData.get('city') as string,
    state: formData.get('state') as string,
    address: formData.get('address') as string,
    googleReviewUrl: (formData.get('googleReviewUrl') as string) || undefined,
    services: (formData.get('services') as string)
      ? (formData.get('services') as string).split(',').map((s) => s.trim()).filter(Boolean)
      : undefined,
    areas: (formData.get('areas') as string)
      ? (formData.get('areas') as string).split(',').map((a) => a.trim()).filter(Boolean)
      : undefined,
    primaryColor: (formData.get('primaryColor') as string) || undefined,
  }

  if (!input.clientId || !input.niche || !input.businessName || !input.phone || !input.email || !input.contactEmail || !input.city || !input.state || !input.address) {
    throw new Error('Missing required fields')
  }

  const result = await generateSite(input)

  if (result.status !== 'READY') {
    throw new Error('Deployment failed')
  }

  revalidatePath('/sites')
  revalidatePath('/clients')

  return { url: result.url }
}
