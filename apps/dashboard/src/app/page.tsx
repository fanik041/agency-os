export const dynamic = 'force-dynamic'

import { getLeads, getClients, getMRR, getScrapeJobs } from '@agency-os/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, Briefcase, DollarSign, Search } from 'lucide-react'
import { JOB_STATUS_COLORS, STATUS_COLORS } from '@/lib/constants'
import type { CallStatus, ScrapeJobStatus } from '@agency-os/db'
import { DeploySiteDialog } from '@/components/sites/deploy-site-dialog'

export default async function DashboardPage() {
  const [leadsRes, clientsRes, mrr, jobsRes] = await Promise.all([
    getLeads(),
    getClients(),
    getMRR(),
    getScrapeJobs(),
  ])

  const leads = leadsRes.data ?? []
  const clients = clientsRes.data ?? []
  const jobs = (jobsRes.data ?? []).slice(0, 5)

  const metrics = [
    { label: 'Total Leads', value: leads.length, icon: Users },
    { label: 'Clients', value: clients.length, icon: Briefcase },
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, icon: DollarSign },
    { label: 'Scrape Jobs', value: (jobsRes.data ?? []).length, icon: Search },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="flex items-center gap-2">
          <DeploySiteDialog />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {m.label}
              </CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {leads.length === 0 ? (
              <p className="text-sm text-muted-foreground">No leads yet. Run a scrape first.</p>
            ) : (
              <div className="space-y-2">
                {leads.slice(0, 8).map((lead) => (
                  <div key={lead.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{lead.name}</span>
                      <span className="ml-2 text-muted-foreground">{lead.city}</span>
                    </div>
                    <Badge variant="secondary" className={STATUS_COLORS[lead.call_status as CallStatus]}>
                      {lead.call_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Scrape Jobs</CardTitle>
          </CardHeader>
          <CardContent>
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No jobs yet.</p>
            ) : (
              <div className="space-y-2">
                {jobs.map((job) => (
                  <div key={job.id} className="flex items-center justify-between text-sm">
                    <div>
                      <span className="font-medium">{job.niches.join(', ')}</span>
                      <span className="ml-2 text-muted-foreground">{job.location}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{job.leads_found} leads</span>
                      <Badge variant="secondary" className={JOB_STATUS_COLORS[job.status as ScrapeJobStatus]}>
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
