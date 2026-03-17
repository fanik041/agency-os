'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SearchCheck } from 'lucide-react'
import type { LeadSource, ScrapeJob } from '@agency-os/db'
import { JOB_STATUS_COLORS } from '@/lib/constants'

export function AdvancedSearchDialog({
  sources,
  scrapeJobs,
}: {
  sources: LeadSource[]
  scrapeJobs: ScrapeJob[]
}) {
  const [open, setOpen] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  // Build a map from scrape_job_id → lead_source for quick lookup
  const sourceByJobId = new Map<string, LeadSource>()
  for (const s of sources) {
    if (s.scrape_job_id) sourceByJobId.set(s.scrape_job_id, s)
  }

  // Import sources (non-scrape)
  const importSources = sources.filter((s) => s.type === 'import')

  // Extract unique niches from scrape jobs
  const nicheSet = new Set<string>()
  for (const job of scrapeJobs) {
    const niches = job.niches ?? []
    for (const n of niches) {
      nicheSet.add(n)
    }
  }
  const allNiches = [...nicheSet].sort()

  function applyFilter(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      params.set(key, value)
    }
    params.delete('page')
    router.push(`/leads?${params.toString()}`)
    setOpen(false)
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <SearchCheck className="mr-1 h-3 w-3" /> Advanced Search
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Advanced Search</DialogTitle>
          <DialogDescription className="sr-only">Filter leads by job history or niche</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="jobs">
          <TabsList className="w-full">
            <TabsTrigger value="jobs" className="flex-1">Job History</TabsTrigger>
            <TabsTrigger value="niches" className="flex-1">By Niche</TabsTrigger>
          </TabsList>

          {/* ── Job History tab ──────────────────────────── */}
          <TabsContent value="jobs" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Filter leads by the scrape or import that produced them.
            </p>

            {scrapeJobs.length === 0 && importSources.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No scrape or import jobs yet.
              </p>
            ) : (
              <div className="max-h-80 overflow-auto rounded-md border divide-y">
                {scrapeJobs.map((job) => {
                  const linkedSource = sourceByJobId.get(job.id)
                  const niches = job.niches ?? []

                  function handleClick() {
                    if (linkedSource) {
                      applyFilter({ source_id: linkedSource.id })
                    } else {
                      // Fallback: filter by niche + city from the job
                      const filters: Record<string, string> = {}
                      if (niches.length === 1) filters.niche = niches[0]
                      if (job.city) filters.city = job.city
                      applyFilter(filters)
                    }
                  }

                  return (
                    <button
                      key={job.id}
                      type="button"
                      onClick={handleClick}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">
                            {niches.join(', ') || 'Unknown'}
                          </span>
                          <Badge
                            variant="secondary"
                            className={JOB_STATUS_COLORS[job.status]}
                          >
                            {job.status}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {job.location} &middot; {job.leads_found} leads &middot;{' '}
                          {formatDate(job.created_at)}
                        </p>
                      </div>
                    </button>
                  )
                })}

                {importSources.map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() => applyFilter({ source_id: source.id })}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {source.label}
                        </span>
                        <Badge variant="secondary" className="bg-orange-100 text-orange-700">
                          import
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {source.leads_count} leads &middot; {formatDate(source.created_at)}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── By Niche tab ───────────────────────────── */}
          <TabsContent value="niches" className="space-y-3 mt-3">
            <p className="text-sm text-muted-foreground">
              Filter leads by niches that were scraped.
            </p>

            {allNiches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No niches found. Run a scrape first.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {allNiches.map((niche) => (
                  <Button
                    key={niche}
                    variant="outline"
                    size="sm"
                    onClick={() => applyFilter({ niche })}
                  >
                    {niche}
                  </Button>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
