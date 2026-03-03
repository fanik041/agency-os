'use client'

import { useState, useTransition } from 'react'
import type { Lead, CallOutcome } from '@agency-os/db'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { logCallAction } from '@/app/leads/actions'
import { convertLeadToClientAction } from '@/app/clients/actions'
import { OUTCOME_LABELS, STATUS_COLORS } from '@/lib/constants'
import { toast } from 'sonner'
import { Briefcase } from 'lucide-react'

const OUTCOMES: CallOutcome[] = [
  'no_answer',
  'voicemail',
  'callback_requested',
  'demo_booked',
  'closed',
  'not_interested',
]

export function CallLoggerSheet({
  lead,
  open,
  onOpenChange,
}: {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [outcome, setOutcome] = useState<CallOutcome | ''>('')
  const [notes, setNotes] = useState('')
  const [duration, setDuration] = useState('')
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    if (!lead || !outcome) return
    startTransition(async () => {
      try {
        await logCallAction(
          lead.id,
          outcome as CallOutcome,
          notes,
          duration ? parseInt(duration, 10) : null
        )
        toast.success('Call logged successfully')
        setOutcome('')
        setNotes('')
        setDuration('')
        onOpenChange(false)
      } catch (err) {
        toast.error('Failed to log call')
      }
    })
  }

  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[480px]">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{lead.phone ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">{lead.email ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Niche</span>
              <span className="font-medium">{lead.niche ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">City</span>
              <span className="font-medium">{lead.city ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Site Quality</span>
              <span className="font-medium">{lead.site_quality ?? 'N/A'}/5</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Current Status</span>
              <Badge variant="secondary" className={STATUS_COLORS[lead.call_status]}>
                {lead.call_status}
              </Badge>
            </div>
          </div>

          {lead.website && (
            <a
              href={lead.website}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 underline"
            >
              {lead.website}
            </a>
          )}

          {lead.call_status !== 'closed' && (
            <Button
              variant="outline"
              className="w-full"
              disabled={isPending}
              onClick={() => {
                startTransition(async () => {
                  try {
                    await convertLeadToClientAction(lead.id)
                    toast.success('Lead converted to client!')
                    onOpenChange(false)
                  } catch {
                    toast.error('Failed to convert lead')
                  }
                })
              }}
            >
              <Briefcase className="mr-2 h-4 w-4" /> Convert to Client
            </Button>
          )}

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Log a Call</h3>

            <div className="space-y-1">
              <Label>Outcome</Label>
              <Select value={outcome} onValueChange={(v) => setOutcome(v as CallOutcome)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  {OUTCOMES.map((o) => (
                    <SelectItem key={o} value={o}>
                      {OUTCOME_LABELS[o]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Notes</Label>
              <Textarea
                value={notes}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                placeholder="Call notes..."
                rows={3}
              />
            </div>

            <div className="space-y-1">
              <Label>Duration (seconds)</Label>
              <Input
                type="number"
                value={duration}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setDuration(e.target.value)}
                placeholder="e.g. 120"
              />
            </div>

            <Button onClick={handleSubmit} disabled={!outcome || isPending} className="w-full">
              {isPending ? 'Logging...' : 'Log Call'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
