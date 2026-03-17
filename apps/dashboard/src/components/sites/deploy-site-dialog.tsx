'use client'

import { useState, useTransition, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { deploySiteAction } from '@/app/sites/actions'
import { toast } from 'sonner'
import { Rocket } from 'lucide-react'
import type { Client } from '@agency-os/db'
import { supabaseBrowser } from '@/lib/supabase-browser'

const NICHES = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'hvac', label: 'HVAC' },
]

export function DeploySiteDialog({ client }: { client?: Client }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<Client | null>(client ?? null)

  // Fetch clients list if no client prop provided
  useEffect(() => {
    if (client || !open) return
    supabaseBrowser
      .from('clients')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (data) setClients(data as Client[])
      })
  }, [open, client])

  function handleClientSelect(clientId: string) {
    const c = clients.find((cl) => cl.id === clientId)
    setSelectedClient(c ?? null)
  }

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        const result = await deploySiteAction(formData)
        toast.success(`Site deployed! ${result.url}`)
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Deployment failed')
      }
    })
  }

  const activeClient = client ?? selectedClient

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v)
      if (!v && !client) setSelectedClient(null)
    }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Rocket className="mr-1 h-3 w-3" /> Deploy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {activeClient ? `Deploy Site — ${activeClient.business_name}` : 'Deploy Site'}
          </DialogTitle>
          <DialogDescription className="sr-only">Configure and deploy a new client site</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          {!client && (
            <div className="space-y-1">
              <Label htmlFor="clientSelect">Client</Label>
              <select
                id="clientSelect"
                required
                value={selectedClient?.id ?? ''}
                onChange={(e) => handleClientSelect(e.target.value)}
                className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="" disabled>Select a client...</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.business_name}</option>
                ))}
              </select>
            </div>
          )}

          <input type="hidden" name="clientId" value={activeClient?.id ?? ''} />

          <div className="space-y-1">
            <Label htmlFor="niche">Template</Label>
            <select
              id="niche"
              name="niche"
              required
              defaultValue={activeClient?.niche ?? ''}
              key={activeClient?.id}
              className="w-full rounded-md border px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="" disabled>Select a template...</option>
              {NICHES.map((n) => (
                <option key={n.value} value={n.value}>{n.label}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="businessName">Business Name</Label>
              <Input id="businessName" name="businessName" required defaultValue={activeClient?.business_name ?? ''} key={`bn-${activeClient?.id}`} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" required defaultValue={activeClient?.phone ?? ''} key={`ph-${activeClient?.id}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">Business Email</Label>
              <Input id="email" name="email" type="email" required defaultValue={activeClient?.email ?? ''} key={`em-${activeClient?.id}`} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="contactEmail">Lead Notification Email</Label>
              <Input id="contactEmail" name="contactEmail" type="email" required defaultValue={activeClient?.email ?? ''} key={`ce-${activeClient?.id}`} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" required defaultValue={activeClient?.city ?? ''} key={`ci-${activeClient?.id}`} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="state">State</Label>
              <Input id="state" name="state" required placeholder="TX" />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="address">Full Address</Label>
            <Input id="address" name="address" required placeholder="123 Main St, City, ST 12345" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="googleReviewUrl">Google Review URL (optional)</Label>
            <Input id="googleReviewUrl" name="googleReviewUrl" placeholder="https://g.page/..." />
          </div>

          <div className="space-y-1">
            <Label htmlFor="services">Services (comma-separated, optional)</Label>
            <Input id="services" name="services" placeholder="Emergency plumbing, Drain cleaning, Water heater" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="areas">Service Areas (comma-separated, optional)</Label>
            <Input id="areas" name="areas" placeholder="Downtown, North Side, South Side" />
          </div>

          <div className="space-y-1">
            <Label htmlFor="primaryColor">Primary Color (optional)</Label>
            <Input id="primaryColor" name="primaryColor" type="color" defaultValue="#1e40af" className="h-10" />
          </div>

          <Button type="submit" disabled={isPending || !activeClient} className="w-full">
            {isPending ? 'Deploying...' : 'Deploy Site'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
