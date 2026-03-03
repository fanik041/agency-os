'use client'

import { useEffect, useState } from 'react'
import type { ResearchJob } from '@agency-os/db'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { JOB_STATUS_COLORS } from '@/lib/constants'
import { supabaseBrowser } from '@/lib/supabase-browser'

function JobTimestamp({ date }: { date: string }) {
  const [formatted, setFormatted] = useState('')
  useEffect(() => {
    setFormatted(new Date(date).toLocaleString())
  }, [date])
  return <p className="text-xs text-muted-foreground">{formatted || date}</p>
}

export function ResearchProgress({ initialJobs }: { initialJobs: ResearchJob[] }) {
  const [jobs, setJobs] = useState(initialJobs)

  useEffect(() => {
    const channel = supabaseBrowser
      .channel('research_jobs_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'research_jobs' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setJobs((prev) => [payload.new as ResearchJob, ...prev])
          } else if (payload.eventType === 'UPDATE') {
            setJobs((prev) =>
              prev.map((j) =>
                j.id === (payload.new as ResearchJob).id ? (payload.new as ResearchJob) : j
              )
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabaseBrowser.removeChannel(channel)
    }
  }, [])

  const activeJobs = jobs.filter((j) => j.status === 'queued' || j.status === 'running')
  const recentJobs = jobs.filter((j) => j.status === 'done' || j.status === 'failed').slice(0, 5)
  const displayJobs = [...activeJobs, ...recentJobs]

  if (displayJobs.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Research Jobs</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {displayJobs.map((job) => {
            const progress = job.total > 0 ? (job.processed / job.total) * 100 : 0

            return (
              <div key={job.id} className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {job.total} lead{job.total !== 1 ? 's' : ''}
                  </span>
                  <Badge variant="secondary" className={JOB_STATUS_COLORS[job.status]}>
                    {job.status}
                  </Badge>
                </div>

                {(job.status === 'running' || job.status === 'done') && (
                  <div className="space-y-1">
                    <Progress value={Math.min(progress, 100)} />
                    <p className="text-xs text-muted-foreground">
                      {job.processed}/{job.total} processed — {job.contacts_found} contact
                      {job.contacts_found !== 1 ? 's' : ''} found
                    </p>
                  </div>
                )}

                {job.error_message && (
                  <p className="text-xs text-red-600">{job.error_message}</p>
                )}

                <JobTimestamp date={job.created_at} />
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
