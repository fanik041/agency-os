export const dynamic = 'force-dynamic'

import { getMRR, getRevenueSummary, getClients } from '@agency-os/db'
import type { RevenueType } from '@agency-os/db'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DollarSign, TrendingUp, PiggyBank, RefreshCw } from 'lucide-react'
import { AddEventDialog } from '@/components/revenue/add-event-dialog'

const TYPE_COLORS: Record<string, string> = {
  deposit: 'bg-blue-100 text-blue-700',
  final: 'bg-green-100 text-green-700',
  retainer: 'bg-purple-100 text-purple-700',
}

export default async function RevenuePage() {
  const [mrr, { data: events }, { data: clients }] = await Promise.all([
    getMRR(),
    getRevenueSummary(),
    getClients(),
  ])

  const allEvents = events ?? []
  const allClients = clients ?? []

  const totalRevenue = allEvents.reduce((sum, e) => sum + e.amount, 0)
  const pipelineValue = allClients.reduce((sum, c) => {
    const remaining = (c.deal_value ?? 0) - c.paid_upfront - c.paid_final
    return sum + Math.max(remaining, 0)
  }, 0)
  const activeRetainers = allClients.filter((c) => c.retainer_active).length

  const metrics = [
    { label: 'MRR', value: `$${mrr.toLocaleString()}`, icon: RefreshCw },
    { label: 'Total Revenue', value: `$${totalRevenue.toLocaleString()}`, icon: DollarSign },
    { label: 'Pipeline Value', value: `$${pipelineValue.toLocaleString()}`, icon: TrendingUp },
    { label: 'Active Retainers', value: activeRetainers, icon: PiggyBank },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Revenue</h1>
        <AddEventDialog clients={allClients} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <Card key={m.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{m.label}</CardTitle>
              <m.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{m.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revenue Events</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {allEvents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No revenue events yet.
                  </TableCell>
                </TableRow>
              ) : (
                allEvents.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell>{ev.date}</TableCell>
                    <TableCell className="font-medium">
                      {(ev as unknown as { clients?: { business_name: string } }).clients?.business_name ?? '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={TYPE_COLORS[ev.type as RevenueType] ?? ''}>
                        {ev.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${ev.amount.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{ev.notes ?? '—'}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
