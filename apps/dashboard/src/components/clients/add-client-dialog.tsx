'use client'

import { useState, useTransition } from 'react'
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
import { createClientAction } from '@/app/clients/actions'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export function AddClientDialog() {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await createClientAction(formData)
        toast.success('Client created')
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create client')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Client
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add New Client</DialogTitle>
          <DialogDescription className="sr-only">Enter details to create a new client</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="business_name">Business Name</Label>
            <Input id="business_name" name="business_name" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="contact_name">Contact Name</Label>
              <Input id="contact_name" name="contact_name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" name="phone" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="email">Email</Label>
              <Input id="email" name="email" type="email" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="deal_value">Deal Value ($)</Label>
              <Input id="deal_value" name="deal_value" type="number" step="0.01" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="niche">Niche</Label>
              <Input id="niche" name="niche" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="city">City</Label>
              <Input id="city" name="city" />
            </div>
          </div>
          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Creating...' : 'Create Client'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
