'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateLeadFieldAction } from '@/app/crm/actions'

export function CellBoolean({
  leadId,
  field,
  initial,
}: {
  leadId: string
  field: string
  initial: boolean | null
}) {
  const [value, setValue] = useState<boolean>(!!initial)
  const [error, setError] = useState(false)

  async function toggle() {
    const next = !value
    setValue(next)
    setError(false)
    try {
      const res = await updateLeadFieldAction(leadId, field, next)
      if (!('ok' in res) || !res.ok) throw new Error('save failed')
    } catch (err) {
      setError(true)
      setValue(value)
      toast.error(`Failed to save ${field}: ${String(err)}`)
    }
  }

  return (
    <input
      type="checkbox"
      checked={value}
      onChange={toggle}
      className={error ? 'ring-2 ring-red-500' : ''}
    />
  )
}
