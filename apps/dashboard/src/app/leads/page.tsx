export const dynamic = 'force-dynamic'

import { getLeads, getLeadFilterOptions, getScrapeJobs } from '@agency-os/db'
import type { LeadStatus } from '@agency-os/db'
import { LeadsClient } from '@/components/leads/leads-client'
import { ImportLeadsDialog } from '@/components/leads/import-leads-dialog'
import { AdvancedSearchDialog } from '@/components/leads/advanced-search-dialog'
import { AttioViewerButton } from '@/components/leads/attio-viewer-button'
import { SyncAttioButton } from '@/components/leads/update-attio-button'
import { DeduplicateLeadsButton } from '@/components/leads/deduplicate-leads-button'
import { ScoreLeadsButton } from '@/components/leads/score-leads-button'

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>
}) {
  const params = await searchParams
  const page = params.page ? parseInt(params.page, 10) : 1
  const perPage = params.per_page ? parseInt(params.per_page, 10) : 50

  const [leadsRes, filterOptions, scrapeJobsRes] = await Promise.all([
    getLeads({
      niche: params.niche,
      city: params.city,
      status: params.status as LeadStatus | undefined,
      minPainScore: params.min_quality ? parseInt(params.min_quality, 10) : undefined,
      q: params.q,
      sourceId: params.source_id,
      page,
      perPage,
    }),
    getLeadFilterOptions(),
    getScrapeJobs(),
  ])

  const leads = leadsRes.data ?? []
  const totalCount = leadsRes.count ?? 0
  const scrapeJobs = scrapeJobsRes.data ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#1c1e21]">Leads</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{totalCount} leads</span>
          <AdvancedSearchDialog sources={filterOptions.sources} scrapeJobs={scrapeJobs} />
          <ScoreLeadsButton />
          <AttioViewerButton />
          <DeduplicateLeadsButton />
          <SyncAttioButton />
          <ImportLeadsDialog />
        </div>
      </div>
      <LeadsClient
        leads={leads}
        niches={filterOptions.niches}
        cities={filterOptions.cities}
        sources={filterOptions.sources}
        totalCount={totalCount}
        page={page}
        perPage={perPage}
      />
    </div>
  )
}
