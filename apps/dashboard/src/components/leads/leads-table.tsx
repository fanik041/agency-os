'use client'

import { useTransition } from 'react'
import type { Lead } from '@agency-os/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { STATUS_COLORS } from '@/lib/constants'
import { convertLeadToClientAction } from '@/app/clients/actions'
import { triggerResearchAction } from '@/app/contacts/actions'
import { toast } from 'sonner'
import { MoreHorizontal, Briefcase, UserSearch } from 'lucide-react'

export function LeadsTable({
  leads,
  onSelectLead,
  selectedIds,
  onSelectedIdsChange,
}: {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
}) {
  const allSelected = leads.length > 0 && leads.every((l) => selectedIds.has(l.id))

  function handleSelectAll(checked: boolean) {
    if (checked) {
      const newSet = new Set(selectedIds)
      leads.forEach((l) => newSet.add(l.id))
      onSelectedIdsChange(newSet)
    } else {
      const newSet = new Set(selectedIds)
      leads.forEach((l) => newSet.delete(l.id))
      onSelectedIdsChange(newSet)
    }
  }

  function handleSelectOne(id: string, checked: boolean) {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    onSelectedIdsChange(newSet)
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead>Niche</TableHead>
            <TableHead>City</TableHead>
            <TableHead className="text-center">Rating</TableHead>
            <TableHead className="text-center">Site Quality</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={9} className="text-center text-muted-foreground">
                No leads found. Run a scrape to get started.
              </TableCell>
            </TableRow>
          ) : (
            leads.map((lead) => (
              <LeadRow
                key={lead.id}
                lead={lead}
                onSelectLead={onSelectLead}
                selected={selectedIds.has(lead.id)}
                onSelectedChange={(checked) => handleSelectOne(lead.id, checked)}
              />
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function LeadRow({
  lead,
  onSelectLead,
  selected,
  onSelectedChange,
}: {
  lead: Lead
  onSelectLead: (lead: Lead) => void
  selected: boolean
  onSelectedChange: (checked: boolean) => void
}) {
  const [isPending, startTransition] = useTransition()

  function handleConvert(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await convertLeadToClientAction(lead.id)
        toast.success(`"${lead.name}" converted to client`)
      } catch {
        toast.error('Failed to convert lead')
      }
    })
  }

  function handleResearch(e: React.MouseEvent) {
    e.stopPropagation()
    startTransition(async () => {
      try {
        await triggerResearchAction([lead.id])
        toast.success(`Research started for "${lead.name}"`)
      } catch {
        toast.error('Failed to start research')
      }
    })
  }

  return (
    <TableRow
      className="cursor-pointer hover:bg-muted/50"
      onClick={() => onSelectLead(lead)}
    >
      <TableCell onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={selected}
          onCheckedChange={(checked) => onSelectedChange(!!checked)}
          aria-label={`Select ${lead.name}`}
        />
      </TableCell>
      <TableCell className="font-medium">{lead.name}</TableCell>
      <TableCell>{lead.phone ?? '—'}</TableCell>
      <TableCell>{lead.niche ?? '—'}</TableCell>
      <TableCell>{lead.city ?? '—'}</TableCell>
      <TableCell className="text-center">
        {lead.rating ? `${lead.rating} (${lead.review_count})` : '—'}
      </TableCell>
      <TableCell className="text-center">{lead.site_quality ?? '—'}</TableCell>
      <TableCell>
        <Badge variant="secondary" className={STATUS_COLORS[lead.call_status]}>
          {lead.call_status}
        </Badge>
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={handleResearch}>
              <UserSearch className="mr-2 h-4 w-4" />
              Research Contacts
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleConvert} disabled={lead.call_status === 'closed'}>
              <Briefcase className="mr-2 h-4 w-4" />
              Convert to Client
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  )
}
