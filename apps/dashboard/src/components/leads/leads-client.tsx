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
import { UserSearch } from 'lucide-react'

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

  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <LeadFilters niches={niches} cities={cities} sources={sources} />
        {selectedIds.size > 0 && (
          <Button onClick={handleResearchSelected} disabled={isPending} size="sm">
            <UserSearch className="mr-2 h-4 w-4" />
            {isPending ? 'Starting...' : `Research Selected (${selectedIds.size})`}
          </Button>
        )}
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
