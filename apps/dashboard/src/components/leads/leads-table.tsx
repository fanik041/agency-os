'use client'

import { useState, useTransition } from 'react'
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
import { STATUS_COLORS, LEAD_STATUS_LABELS } from '@/lib/constants'
import { convertLeadToClientAction } from '@/app/clients/actions'
import { toast } from 'sonner'
import { MoreHorizontal, Briefcase, UserSearch, ChevronDown, ChevronRight } from 'lucide-react'

export function LeadsTable({
  leads,
  onSelectLead,
  selectedIds,
  onSelectedIdsChange,
  onResearchLead,
}: {
  leads: Lead[]
  onSelectLead: (lead: Lead) => void
  selectedIds: Set<string>
  onSelectedIdsChange: (ids: Set<string>) => void
  onResearchLead?: (leadId: string) => void
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
    <div className="rounded-lg border border-[#dadde1] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)]">
      <Table className="table-fixed">
        <TableHeader>
          <TableRow className="bg-[#f0f2f5] hover:bg-[#f0f2f5]">
            <TableHead className="w-10">
              <Checkbox
                checked={allSelected}
                onCheckedChange={(checked) => handleSelectAll(!!checked)}
                aria-label="Select all"
              />
            </TableHead>
            <TableHead className="w-[18%]">Name</TableHead>
            <TableHead className="w-[9%]">Phone</TableHead>
            <TableHead className="w-[7%]">Niche</TableHead>
            <TableHead className="w-[9%]">Email</TableHead>
            <TableHead className="w-[12%]">Place ID</TableHead>
            <TableHead className="text-center w-[5%]">Rating</TableHead>
            <TableHead className="text-center w-[5%]">Count</TableHead>
            <TableHead className="text-center w-[4%]">Pain</TableHead>
            <TableHead className="w-[8%]">Status</TableHead>
            <TableHead className="w-[6%]">Attio</TableHead>
            <TableHead className="text-center w-[4%]">Reviews</TableHead>
            <TableHead className="w-10" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {leads.length === 0 ? (
            <TableRow>
              <TableCell colSpan={13} className="text-center text-muted-foreground">
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
                onResearchLead={onResearchLead}
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
  onResearchLead,
}: {
  lead: Lead
  onSelectLead: (lead: Lead) => void
  selected: boolean
  onSelectedChange: (checked: boolean) => void
  onResearchLead?: (leadId: string) => void
}) {
  const [isPending, startTransition] = useTransition()
  const [reviewsOpen, setReviewsOpen] = useState(false)

  const reviews = lead.reviews_raw ? lead.reviews_raw.split(' | ') : []

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
    onResearchLead?.(lead.id)
  }

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-[#f7f8fa] border-[#e4e6eb]"
        onClick={() => onSelectLead(lead)}
      >
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onCheckedChange={(checked) => onSelectedChange(!!checked)}
            aria-label={`Select ${lead.name}`}
          />
        </TableCell>
        <TableCell className="font-medium break-words">{lead.name}</TableCell>
        <TableCell>{lead.phone ?? '—'}</TableCell>
        <TableCell>{lead.niche ?? '—'}</TableCell>
        <TableCell className="text-xs break-words">{lead.email_found ?? '—'}</TableCell>
        <TableCell className="text-xs break-words">{lead.address ?? '—'}</TableCell>
        <TableCell className="text-center">
          {lead.rating != null ? `${lead.rating}/5` : '—'}
        </TableCell>
        <TableCell className="text-center">{lead.review_count ?? 0}</TableCell>
        <TableCell className="text-center">{lead.pain_score != null ? `${lead.pain_score}/9` : '—'}</TableCell>
        <TableCell>
          <Badge variant="secondary" className={STATUS_COLORS[lead.status]}>
            {LEAD_STATUS_LABELS[lead.status]}
          </Badge>
        </TableCell>
        <TableCell>
          <Badge
            variant="secondary"
            className={lead.attio_sync_status === 'synced' ? 'bg-green-500/15 text-green-500' : 'bg-zinc-500/15 text-zinc-400'}
          >
            {lead.attio_sync_status === 'synced' ? 'Synced' : 'Not Synced'}
          </Badge>
        </TableCell>
        <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
          {reviews.length > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 gap-1 text-xs"
              onClick={() => setReviewsOpen(!reviewsOpen)}
            >
              {reviewsOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
              {reviews.length}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
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
              <DropdownMenuItem onClick={handleConvert} disabled={lead.status === 'closed'}>
                <Briefcase className="mr-2 h-4 w-4" />
                Convert to Client
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
      {reviewsOpen && reviews.length > 0 && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          <TableCell colSpan={13} className="py-2 px-6">
            <div className="max-h-48 overflow-auto space-y-1.5 text-xs">
              {reviews.map((review, i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-semibold text-muted-foreground shrink-0">Review {i + 1}:</span>
                  <span>{review}</span>
                </div>
              ))}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
