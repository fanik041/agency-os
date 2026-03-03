export const dynamic = 'force-dynamic'

import { getClients } from '@agency-os/db'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { SITE_STATUS_COLORS } from '@/lib/constants'
import { AddClientDialog } from '@/components/clients/add-client-dialog'
import Link from 'next/link'
import type { SiteStatus } from '@agency-os/db'

export default async function ClientsPage() {
  const { data: clients } = await getClients()
  const allClients = clients ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Clients</h1>
        <AddClientDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>City</TableHead>
              <TableHead>Site Status</TableHead>
              <TableHead className="text-right">Deal Value</TableHead>
              <TableHead>Retainer</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No clients yet. Convert a lead or add one manually.
                </TableCell>
              </TableRow>
            ) : (
              allClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <Link href={`/clients/${client.id}`} className="font-medium hover:underline">
                      {client.business_name}
                    </Link>
                  </TableCell>
                  <TableCell>
                    {client.contact_name ?? '—'}
                    {client.phone && (
                      <span className="ml-1 text-xs text-muted-foreground">{client.phone}</span>
                    )}
                  </TableCell>
                  <TableCell>{client.niche ?? '—'}</TableCell>
                  <TableCell>{client.city ?? '—'}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={SITE_STATUS_COLORS[client.site_status as SiteStatus]}>
                      {client.site_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {client.deal_value ? `$${client.deal_value.toLocaleString()}` : '—'}
                  </TableCell>
                  <TableCell>
                    {client.retainer_active ? (
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        ${client.retainer_amount}/mo
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
