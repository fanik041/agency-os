'use server'

import { revalidatePath } from 'next/cache'
import { requireAuth } from '@/lib/auth'
import { container } from '@/lib/container'
import { addRevenueEventSchema } from '@agency-os/db'

export async function addRevenueEventAction(formData: FormData) {
  await requireAuth()

  const parsed = addRevenueEventSchema.parse({
    client_id: formData.get('client_id') as string,
    type: formData.get('type') as string,
    amount: parseFloat(formData.get('amount') as string),
    date: formData.get('date') as string,
    notes: (formData.get('notes') as string) || null,
  })

  await container.revenueRepo.add(parsed)
  revalidatePath('/revenue')
}
