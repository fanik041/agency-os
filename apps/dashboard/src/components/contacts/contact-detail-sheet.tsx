'use client'

import { useState, useTransition } from 'react'
import type { Contact } from '@agency-os/db'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { TagInput } from './tag-input'
import { LeadLinkSelect } from './lead-link-select'
import { updateContactNotesAction } from '@/app/contacts/actions'
import { toast } from 'sonner'

interface ContactWithLead extends Contact {
  leads: { name: string; niche: string | null; city: string | null } | null
}

interface LeadMinimal {
  id: string
  name: string
  niche: string | null
  city: string | null
}

const SOURCE_LABELS: Record<string, string> = {
  google_linkedin: 'Google/LinkedIn',
  website_about: 'Website',
  website_contact: 'Website Contact',
  manual: 'Manual',
}

const CONFIDENCE_COLORS: Record<number, string> = {
  5: 'bg-green-100 text-green-700',
  4: 'bg-blue-100 text-blue-700',
  3: 'bg-yellow-100 text-yellow-700',
  2: 'bg-orange-100 text-orange-700',
  1: 'bg-red-100 text-red-700',
}

export function ContactDetailSheet({
  contact,
  leads,
  open,
  onOpenChange,
  onContactUpdate,
}: {
  contact: ContactWithLead | null
  leads: LeadMinimal[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onContactUpdate?: () => void
}) {
  const [notes, setNotes] = useState(contact?.notes ?? '')
  const [isPending, startTransition] = useTransition()

  // Reset notes when contact changes
  if (contact && notes !== (contact.notes ?? '') && !isPending) {
    setNotes(contact.notes ?? '')
  }

  function handleSaveNotes() {
    if (!contact) return
    startTransition(async () => {
      try {
        await updateContactNotesAction(contact.id, notes)
        toast.success('Notes saved')
        onContactUpdate?.()
      } catch {
        toast.error('Failed to save notes')
      }
    })
  }

  if (!contact) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[520px]">
        <SheetHeader>
          <SheetTitle>{contact.name}</SheetTitle>
          <SheetDescription>{contact.title ?? 'No title'}</SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Contact info */}
          <div className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email</span>
              <span className="font-medium">
                {contact.email ? (
                  <a href={`mailto:${contact.email}`} className="text-blue-600 hover:underline">
                    {contact.email}
                  </a>
                ) : (
                  'N/A'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Phone</span>
              <span className="font-medium">{contact.phone ?? 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">LinkedIn</span>
              <span className="font-medium">
                {contact.linkedin_url ? (
                  <a
                    href={contact.linkedin_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Profile
                  </a>
                ) : (
                  'N/A'
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <span className="font-medium">
                {contact.source ? SOURCE_LABELS[contact.source] ?? contact.source : 'N/A'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Confidence</span>
              {contact.confidence ? (
                <Badge
                  variant="secondary"
                  className={CONFIDENCE_COLORS[contact.confidence] ?? ''}
                >
                  {contact.confidence}/5
                </Badge>
              ) : (
                <span className="font-medium">N/A</span>
              )}
            </div>
          </div>

          <Separator />

          {/* Linked lead */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">
              Linked Lead
            </Label>
            <LeadLinkSelect
              contactId={contact.id}
              currentLeadId={contact.lead_id}
              leads={leads}
              onLinked={() => onContactUpdate?.()}
            />
          </div>

          <Separator />

          {/* Tags */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Tags</Label>
            <TagInput
              contactId={contact.id}
              tags={contact.tags ?? []}
              onTagsChange={() => onContactUpdate?.()}
            />
          </div>

          <Separator />

          {/* Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold uppercase text-muted-foreground">Notes</Label>
            <Textarea
              value={notes}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
              placeholder="Add notes about this contact..."
              rows={5}
            />
            <Button
              onClick={handleSaveNotes}
              disabled={isPending || notes === (contact.notes ?? '')}
              size="sm"
              className="w-full"
            >
              {isPending ? 'Saving...' : 'Save Notes'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
