'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { updateLeadFieldAction } from '@/app/crm/actions'
import { LeadStatus } from '@agency-os/db'

const STATUS_VALUES = Object.values(LeadStatus) as LeadStatus[]

export function CellStatus({
  leadId,
  initial,
}: {
  leadId: string
  initial: LeadStatus
}) {
  const [value, setValue] = useState<LeadStatus>(initial)
  const [error, setError] = useState(false)

  async function change(next: LeadStatus) {
    setValue(next)
    setError(false)
    try {
      const res = await updateLeadFieldAction(leadId, 'status', next)
      if (!('ok' in res) || !res.ok) throw new Error('save failed')
    } catch (err) {
      setError(true)
      setValue(value)
      toast.error(`Failed to save status: ${String(err)}`)
    }
  }

  return (
    <select
      value={value}
      onChange={e => change(e.target.value as LeadStatus)}
      className={`w-full bg-white px-1 py-0.5 outline-none ${error ? 'ring-1 ring-red-500' : ''}`}
    >
      {STATUS_VALUES.map(s => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  )
}
