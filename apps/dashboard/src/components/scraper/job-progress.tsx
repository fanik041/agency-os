'use client'

import { useEffect, useState, useTransition } from 'react'
import type { ScrapeJob } from '@agency-os/db'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JOB_STATUS_COLORS } from '@/lib/constants'
import { supabaseBrowser } from '@/lib/supabase-browser'
import { updateJobStatusAction } from '@/app/scraper/actions'
import { toast } from 'sonner'
import { CheckCircle, XCircle, ChevronDown, ChevronUp } from 'lucide-react'

const LOG_PREVIEW_LENGTH = 280

function JobLog({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false)
  const isLong = message.length > LOG_PREVIEW_LENGTH
  const displayText = isLong && !expanded ? `${message.slice(0, LOG_PREVIEW_LENGTH).trim()}…` : message

  return (
    <div className="rounded-md border border-border bg-muted/30 p-3">
      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-muted-foreground overflow-x-auto max-h-[320px] overflow-y-auto">
        {displayText}
      </pre>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" /> Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" /> Read more
            </>
          )}
        </button>
      )}
    </div>
  )
}

function JobTimestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState('')
  useEffect(() => {
    setFormatted(new Date(date).toLocaleString())
  }, [date])
  return <p className="text-xs text-muted-foreground">{formatted || date}</p>
}

function JobStatusButtons({ job }: { job: ScrapeJob }) {
  const [isPending, startTransition] = useTransition()

  if (job.status !== 'queued' && job.status !== 'running') return null

  function handleStatusChange(status: 'done' | 'failed') {
    startTransition(async () => {
      try {
        await updateJobStatusAction(job.id, status)
        toast.success(`Job marked as ${status}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update job')
      }
    })
  }

  return (
    <div className="flex gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => handleStatusChange('done')}
        className="h-6 px-2 text-xs"
      >
        <CheckCircle className="mr-1 h-3 w-3" /> Done
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={isPending}
        onClick={() => handleStatusChange('failed')}
        className="h-6 px-2 text-xs text-red-600 hover:text-red-700"
      >
        <XCircle className="mr-1 h-3 w-3" /> Failed
      </Button>
    </div>
  )
}

export function JobProgress({ initialJobs }: { initialJobs: ScrapeJob[] }) {
  const [jobs, setJobs] = useState(initialJobs)

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('scrape_jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'scrape_jobs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new as ScrapeJob, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((j) => (j.id === (payload.new as ScrapeJob).id ? (payload.new as ScrapeJob) : j))
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Job History</CardTitle>
      </CardHeader>
      <CardContent>
        {jobs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No jobs yet.</p>
        ) : (
          <div className="space-y-4">
            {jobs.map((job) => {
              const niches = job.niches ?? []
              const totalExpected = job.max_per_niche * niches.length
              const progress = totalExpected > 0 ? (job.leads_found / totalExpected) * 100 : 0

              return (
                <div key={job.id} className="space-y-2 rounded-md border p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm font-medium">{niches.join(', ') || 'Unknown'}</span>
                      <span className="ml-2 text-sm text-muted-foreground">{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className={JOB_STATUS_COLORS[job.status]}>
                        {job.status}
                      </Badge>
                      <JobStatusButtons job={job} />
                    </div>
                  </div>

                  {(job.status === 'running' || job.status === 'done') && (
                    <div className="space-y-1">
                      <Progress value={Math.min(progress, 100)} />
                      <p className="text-xs text-muted-foreground">
                        {job.leads_found} / {totalExpected} leads
                      </p>
                    </div>
                  )}

                  {job.error_message && (
                    <JobLog message={job.error_message} />
                  )}

                  <JobTimestamp date={job.created_at} />
                </div>
              )
            })}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
