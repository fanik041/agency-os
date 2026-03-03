export const dynamic = 'force-dynamic'

import { getClient, getRevenueEventsForClient } from '@agency-os/db'
import { notFound } from 'next/navigation'
import { ClientDetailForm } from '@/components/clients/client-detail-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [{ data: client, error }, { data: revenueEvents }] = await Promise.all([
    getClient(id),
    getRevenueEventsForClient(id),
  ])

  if (error || !client) notFound()

  const events = revenueEvents ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/clients" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-bold">{client.business_name}</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ClientDetailForm client={client} />
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Revenue Events</CardTitle>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <p className="text-sm text-muted-foreground">No revenue events yet.</p>
              ) : (
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev.id} className="flex items-center justify-between text-sm">
                      <div>
                        <Badge variant="secondary">{ev.type}</Badge>
                        <span className="ml-2 text-muted-foreground">{ev.date}</span>
                      </div>
                      <span className="font-medium">${ev.amount.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
