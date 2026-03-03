export const dynamic = 'force-dynamic'

import { getClients } from '@agency-os/db'
import type { Client, SiteStatus } from '@agency-os/db'
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
import { DeploySiteDialog } from '@/components/sites/deploy-site-dialog'

export default async function SitesPage() {
  const { data: clients } = await getClients()
  const allClients = clients ?? []

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sites</h1>
        <DeploySiteDialog />
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Business</TableHead>
              <TableHead>Niche</TableHead>
              <TableHead>Site URL</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {allClients.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground">
                  No clients yet.
                </TableCell>
              </TableRow>
            ) : (
              allClients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell className="font-medium">{client.business_name}</TableCell>
                  <TableCell>{client.niche ?? '—'}</TableCell>
                  <TableCell>
                    {client.site_url ? (
                      <a
                        href={client.site_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {client.site_url}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">Not set</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={SITE_STATUS_COLORS[client.site_status as SiteStatus]}>
                      {client.site_status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DeploySiteDialog client={client as Client} />
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
