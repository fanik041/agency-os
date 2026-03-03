'use client'

import { useTransition } from 'react'
import type { Client } from '@agency-os/db'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { updateClientAction } from '@/app/clients/actions'
import { toast } from 'sonner'

export function ClientDetailForm({ client }: { client: Client }) {
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await updateClientAction(client.id, formData)
        toast.success('Client updated')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update client')
      }
    })
  }

  return (
    <form action={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Client Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="business_name">Business Name</Label>
              <Input id="business_name" name="business_name" defaultValue={client.business_name} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" name="contact_name" defaultValue={client.contact_name ?? ''} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" defaultValue={client.phone ?? ''} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" defaultValue={client.email ?? ''} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" name="niche" defaultValue={client.niche ?? ''} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" defaultValue={client.city ?? ''} />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="site_url">Site URL</Label>
            <Input id="site_url" name="site_url" defaultValue={client.site_url ?? ''} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="site_status">Site Status</Label>
            <Select name="site_status" defaultValue={client.site_status}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="building">Building</SelectItem>
                <SelectItem value="live">Live</SelectItem>
                <SelectItem value="paused">Paused</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="deal_value">Deal Value ($)</Label>
              <Input id="deal_value" name="deal_value" type="number" step="0.01" defaultValue={client.deal_value ?? ''} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid_upfront">Paid Upfront ($)</Label>
              <Input id="paid_upfront" name="paid_upfront" type="number" step="0.01" defaultValue={client.paid_upfront} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="paid_final">Paid Final ($)</Label>
              <Input id="paid_final" name="paid_final" type="number" step="0.01" defaultValue={client.paid_final} />
            </div>
          </div>

          <Separator />

          <div className="space-y-3">
            <h3 className="text-sm font-semibold">Retainer</h3>
            <div className="flex items-center gap-2">
              <Switch id="retainer_active" name="retainer_active" defaultChecked={client.retainer_active} />
              <Label htmlFor="retainer_active">Active Retainer</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="retainer_amount">Monthly Amount ($)</Label>
                <Input
                  id="retainer_amount"
                  name="retainer_amount"
                  type="number"
                  step="0.01"
                  defaultValue={client.retainer_amount}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="retainer_billing_day">Billing Day (1-28)</Label>
                <Input
                  id="retainer_billing_day"
                  name="retainer_billing_day"
                  type="number"
                  min={1}
                  max={28}
                  defaultValue={client.retainer_billing_day ?? ''}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? 'Saving...' : 'Save Changes'}
      </Button>
    </form>
  )
}
