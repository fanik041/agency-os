'use client'

import { useState, useTransition } from 'react'
import type { Lead } from '@agency-os/db'
import { CallOutcome } from '@agency-os/db'
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
import { OUTCOME_LABELS, STATUS_COLORS, LEAD_STATUS_LABELS } from '@/lib/constants'
import { toast } from 'sonner'
import { Briefcase, CheckCircle, MessageCircle, FileText } from 'lucide-react'

const OUTCOMES: CallOutcome[] = [
  CallOutcome.NoAnswer,
  CallOutcome.Voicemail,
  CallOutcome.CallbackRequested,
  CallOutcome.DemoBooked,
  CallOutcome.Closed,
  CallOutcome.NotInterested,
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
      <SheetContent className="w-[500px] sm:w-[600px] lg:w-[700px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{lead.name}</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4 pb-8">
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Website</span>
              <span className="font-medium">
                {lead.website ? (
                  <a href={lead.website?.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {lead.website.replace(/https?:\/\//, '')}
                  </a>
                ) : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{lead.phone ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Address</span>
              <span className="font-medium text-xs max-w-[360px] text-right">{lead.address ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Rating</span>
              <span className="font-medium">{lead.rating != null ? `${lead.rating}/5` : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Review Count</span>
              <span className="font-medium">{lead.review_count ?? 0}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Widgets</span>
              <span className="flex items-center gap-1.5">
                {lead.has_booking && <span title="Booking"><CheckCircle className="h-3.5 w-3.5 text-green-500" /></span>}
                {lead.has_chat_widget && <span title="Chat"><MessageCircle className="h-3.5 w-3.5 text-blue-500" /></span>}
                {lead.has_contact_form && <span title="Form"><FileText className="h-3.5 w-3.5 text-purple-500" /></span>}
                {!lead.has_booking && !lead.has_chat_widget && !lead.has_contact_form && 'None'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pain Score</span>
              <span className={`font-medium ${lead.pain_score != null && lead.pain_score >= 6 ? 'text-red-600' : ''}`}>
                {lead.pain_score != null ? `${lead.pain_score}/9` : 'N/A'}
              </span>
            </div>
            {lead.pain_points && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Pain Points</span>
                <span className="max-w-[360px] text-right text-xs leading-relaxed">{lead.pain_points}</span>
              </div>
            )}
            {lead.suggested_angle && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Suggested Angle</span>
                <span className="max-w-[360px] text-right text-xs leading-relaxed">{lead.suggested_angle}</span>
              </div>
            )}
            {lead.message_draft && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Message Draft</span>
                <span className="max-w-[360px] text-right text-xs leading-relaxed">{lead.message_draft}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email Found</span>
              <span className="font-medium">{lead.email_found ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant="secondary" className={STATUS_COLORS[lead.status]}>
                {LEAD_STATUS_LABELS[lead.status]}
              </Badge>
            </div>
            {lead.follow_up_date && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follow Up</span>
                <span className="font-medium">{lead.follow_up_date}</span>
              </div>
            )}
            {lead.notes && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="max-w-[360px] text-right text-xs leading-relaxed">{lead.notes}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Attio Sync</span>
              <span className={`font-medium text-xs ${
                lead.attio_sync_status === 'synced' ? 'text-green-600' :
                lead.attio_sync_status === 'failed' ? 'text-red-600' : 'text-muted-foreground'
              }`}>
                {lead.attio_sync_status === 'synced' ? 'Synced' :
                 lead.attio_sync_status === 'failed' ? 'Failed' : 'Not synced'}
                {lead.attio_synced_at && ` (${lead.attio_synced_at.slice(0, 10)})`}
              </span>
            </div>
          </div>

          {lead.reviews_raw && (
            <div className="rounded-md bg-muted/50 p-2">
              <p className="text-xs font-medium text-muted-foreground mb-1">Reviews</p>
              <div className="text-xs max-h-40 overflow-auto space-y-1.5">
                {lead.reviews_raw.split(' | ').map((review, i) => (
                  <div key={i}>
                    <span className="font-semibold text-muted-foreground">Review {i + 1}:</span>{' '}
                    {review}
                  </div>
                ))}
              </div>
            </div>
          )}

          {lead.status !== 'closed' && (
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
