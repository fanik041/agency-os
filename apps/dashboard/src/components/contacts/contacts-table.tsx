'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { ExportCsvButton } from './export-csv-button'
import { TagInput } from './tag-input'
import { LeadLinkSelect } from './lead-link-select'
import { ContactDetailSheet } from './contact-detail-sheet'
import type { Contact } from '@agency-os/db'

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

export function ContactsTable({
  contacts,
  leads,
}: {
  contacts: ContactWithLead[]
  leads: LeadMinimal[]
}) {
  const [sourceFilter, setSourceFilter] = useState<string>('all')
  const [minConfidence, setMinConfidence] = useState<number>(0)
  const [tagFilter, setTagFilter] = useState<string>('all')
  const [selectedContact, setSelectedContact] = useState<ContactWithLead | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  // Collect all unique tags
  const allTags = [...new Set(contacts.flatMap((c) => c.tags ?? []))].sort()

  const filtered = contacts.filter((c) => {
    if (sourceFilter !== 'all' && c.source !== sourceFilter) return false
    if (minConfidence > 0 && (c.confidence ?? 0) < minConfidence) return false
    if (tagFilter !== 'all' && !(c.tags ?? []).includes(tagFilter)) return false
    return true
  })

  const csvRows = filtered.map((c) => ({
    lead_name: c.leads?.name ?? '—',
    contact_name: c.name,
    title: c.title ?? '',
    email: c.email ?? '',
    phone: c.phone ?? '',
    linkedin_url: c.linkedin_url ?? '',
    source: c.source ? SOURCE_LABELS[c.source] ?? c.source : '',
    confidence: c.confidence?.toString() ?? '',
  }))

  const sources = [...new Set(contacts.map((c) => c.source).filter(Boolean))] as string[]

  function handleRowClick(contact: ContactWithLead) {
    setSelectedContact(contact)
    setSheetOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="rounded-md border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="all">All Sources</option>
          {sources.map((s) => (
            <option key={s} value={s}>{SOURCE_LABELS[s] ?? s}</option>
          ))}
        </select>

        <select
          value={minConfidence}
          onChange={(e) => setMinConfidence(parseInt(e.target.value, 10))}
          className="rounded-md border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value={0}>Any Confidence</option>
          <option value={3}>3+ Confidence</option>
          <option value={4}>4+ Confidence</option>
          <option value={5}>5 Only</option>
        </select>

        {allTags.length > 0 && (
          <select
            value={tagFilter}
            onChange={(e) => setTagFilter(e.target.value)}
            className="rounded-md border px-3 py-1.5 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Tags</option>
            {allTags.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        )}

        <div className="ml-auto">
          <ExportCsvButton contacts={csvRows} />
        </div>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lead</TableHead>
              <TableHead>Contact Name</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>LinkedIn</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Confidence</TableHead>
              <TableHead>Tags</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  No contacts found yet. Run research from the Leads page.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(contact)}
                >
                  <TableCell className="font-medium" onClick={(e) => e.stopPropagation()}>
                    <LeadLinkSelect
                      contactId={contact.id}
                      currentLeadId={contact.lead_id}
                      leads={leads}
                    />
                  </TableCell>
                  <TableCell>{contact.name}</TableCell>
                  <TableCell>{contact.title ?? '—'}</TableCell>
                  <TableCell>
                    {contact.email ? (
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {contact.email}
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>{contact.phone ?? '—'}</TableCell>
                  <TableCell>
                    {contact.linkedin_url ? (
                      <a
                        href={contact.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Profile
                      </a>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.source ? (
                      <span className="text-xs">{SOURCE_LABELS[contact.source] ?? contact.source}</span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell>
                    {contact.confidence ? (
                      <Badge variant="secondary" className={CONFIDENCE_COLORS[contact.confidence] ?? ''}>
                        {contact.confidence}/5
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <TagInput
                      contactId={contact.id}
                      tags={contact.tags ?? []}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="text-xs text-muted-foreground">
        {filtered.length} contact{filtered.length !== 1 ? 's' : ''} shown
      </p>

      <ContactDetailSheet
        contact={selectedContact}
        leads={leads}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
