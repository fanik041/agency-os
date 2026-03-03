'use client'

import { useTransition } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { linkContactToLeadAction } from '@/app/contacts/actions'
import { toast } from 'sonner'

interface LeadMinimal {
  id: string
  name: string
  niche: string | null
  city: string | null
}

export function LeadLinkSelect({
  contactId,
  currentLeadId,
  leads,
  onLinked,
}: {
  contactId: string
  currentLeadId: string | null
  leads: LeadMinimal[]
  onLinked?: (leadId: string | null) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleChange(value: string) {
    const leadId = value === 'unlinked' ? null : value
    startTransition(async () => {
      try {
        await linkContactToLeadAction(contactId, leadId)
        onLinked?.(leadId)
        const leadName = leads.find((l) => l.id === leadId)?.name ?? 'Unlinked'
        toast.success(`Contact linked to ${leadName}`)
      } catch {
        toast.error('Failed to link contact')
      }
    })
  }

  return (
    <Select
      value={currentLeadId ?? 'unlinked'}
      onValueChange={handleChange}
      disabled={isPending}
    >
      <SelectTrigger className="h-8 w-[180px] text-xs" onClick={(e) => e.stopPropagation()}>
        <SelectValue placeholder="Select lead..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unlinked">Unlinked</SelectItem>
        {leads.map((lead) => (
          <SelectItem key={lead.id} value={lead.id}>
            {lead.name}{lead.niche ? ` (${lead.niche})` : ''}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
