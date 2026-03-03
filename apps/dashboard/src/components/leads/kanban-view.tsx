'use client'

import { useTransition } from 'react'
import type { Lead, CallStatus } from '@agency-os/db'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { STATUS_COLORS } from '@/lib/constants'
import { updateLeadStatusAction } from '@/app/leads/actions'
import { toast } from 'sonner'
import { ChevronRight } from 'lucide-react'

const COLUMNS: { status: CallStatus; label: string }[] = [
  { status: 'pending', label: 'Pending' },
  { status: 'called', label: 'Called' },
  { status: 'callback', label: 'Callback' },
  { status: 'interested', label: 'Interested' },
  { status: 'closed', label: 'Closed' },
  { status: 'dead', label: 'Dead' },
]

const MOVE_OPTIONS: CallStatus[] = ['pending', 'called', 'callback', 'interested', 'closed', 'dead']

export function KanbanView({ leads }: { leads: Lead[] }) {
  const [isPending, startTransition] = useTransition()

  function moveLead(leadId: string, newStatus: CallStatus) {
    startTransition(async () => {
      try {
        await updateLeadStatusAction(leadId, newStatus)
        toast.success(`Moved to ${newStatus}`)
      } catch {
        toast.error('Failed to move lead')
      }
    })
  }

  return (
    <div className="grid grid-cols-6 gap-3">
      {COLUMNS.map((col) => {
        const items = leads.filter((l) => l.call_status === col.status)
        return (
          <div key={col.status} className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className={STATUS_COLORS[col.status]}>
                {col.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{items.length}</span>
            </div>
            <div className="space-y-2">
              {items.map((lead) => (
                <Card key={lead.id} className="p-0">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-1">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{lead.name}</p>
                        <p className="text-xs text-muted-foreground">{lead.niche ?? lead.city ?? '—'}</p>
                        {lead.site_quality && (
                          <p className="text-xs text-muted-foreground">Quality: {lead.site_quality}/5</p>
                        )}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" disabled={isPending}>
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {MOVE_OPTIONS.filter((s) => s !== col.status).map((s) => (
                            <DropdownMenuItem key={s} onClick={() => moveLead(lead.id, s)}>
                              Move to {s}
                            </DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
