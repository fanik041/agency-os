'use client'

import { useState, useTransition } from 'react'
import type { Lead, LeadSource } from '@agency-os/db'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { LeadsTable } from './leads-table'
import { KanbanView } from './kanban-view'
import { CallLoggerSheet } from './call-logger-sheet'
import { LeadFilters } from './lead-filters'
import { PaginationControls } from './pagination-controls'
import { triggerResearchAction } from '@/app/contacts/actions'
import { toast } from 'sonner'
import { UserSearch, Download } from 'lucide-react'
import * as XLSX from 'xlsx'

export function LeadsClient({
  leads,
  niches,
  cities,
  sources,
  totalCount,
  page,
  perPage,
}: {
  leads: Lead[]
  niches: string[]
  cities: string[]
  sources: LeadSource[]
  totalCount: number
  page: number
  perPage: number
}) {
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()

  function handleSelectLead(lead: Lead) {
    setSelectedLead(lead)
    setSheetOpen(true)
  }

  function handleResearchSelected() {
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      try {
        await triggerResearchAction(ids)
        toast.success(`Research started for ${ids.length} lead${ids.length !== 1 ? 's' : ''}`)
        setSelectedIds(new Set())
      } catch {
        toast.error('Failed to start research')
      }
    })
  }

  function handleExportXlsx() {
    const data = leads.map((lead) => ({
      Name: lead.name ?? '',
      Phone: lead.phone ?? '',
      Email: lead.email_found ?? '',
      Niche: lead.niche ?? '',
      City: lead.city ?? '',
      Address: lead.address ?? '',
      Website: lead.website ?? '',
      Rating: lead.rating ?? '',
      'Review Count': lead.review_count ?? 0,
      'Pain Score': lead.pain_score ?? '',
      Status: lead.status,
      'Attio Sync': lead.attio_sync_status ?? '',
      'Suggested Angle': lead.suggested_angle ?? '',
      'Message Draft': lead.message_draft ?? '',
      Notes: lead.notes ?? '',
      'Follow Up Date': lead.follow_up_date ?? '',
      'Created At': lead.created_at ?? '',
    }))

    const ws = XLSX.utils.json_to_sheet(data)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Leads')
    XLSX.writeFile(wb, `leads-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
    toast.success(`Exported ${leads.length} leads to XLSX`)
  }

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <LeadFilters niches={niches} cities={cities} sources={sources} />
        <div className="flex items-center gap-2">
          <Button onClick={handleExportXlsx} variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export XLSX
          </Button>
          {selectedIds.size > 0 && (
            <Button onClick={handleResearchSelected} disabled={isPending} size="sm">
              <UserSearch className="mr-2 h-4 w-4" />
              {isPending ? 'Starting...' : `Research Selected (${selectedIds.size})`}
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Table</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="mt-4">
          <LeadsTable
            leads={leads}
            onSelectLead={handleSelectLead}
            selectedIds={selectedIds}
            onSelectedIdsChange={setSelectedIds}
          />
        </TabsContent>

        <TabsContent value="kanban" className="mt-4">
          <KanbanView leads={leads} />
        </TabsContent>
      </Tabs>

      <PaginationControls totalCount={totalCount} page={page} perPage={perPage} />

      <CallLoggerSheet lead={selectedLead} open={sheetOpen} onOpenChange={setSheetOpen} />
    </>
  )
}
