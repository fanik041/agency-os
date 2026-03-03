'use server'

import { addRevenueEvent } from '@agency-os/db'
import type { RevenueType } from '@agency-os/db'
import { revalidatePath } from 'next/cache'

export async function addRevenueEventAction(formData: FormData) {
  const clientId = formData.get('client_id') as string
  const type = formData.get('type') as RevenueType
  const amount = parseFloat(formData.get('amount') as string)
  const date = formData.get('date') as string
  const notes = (formData.get('notes') as string) || null

  if (!clientId || !type || isNaN(amount) || !date) {
    throw new Error('All fields are required')
  }

  const { error } = await addRevenueEvent({
    client_id: clientId,
    type,
    amount,
    date,
    notes,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/revenue')
}
