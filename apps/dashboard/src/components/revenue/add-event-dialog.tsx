'use client'

import { useState, useTransition } from 'react'
import type { Client } from '@agency-os/db'
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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { addRevenueEventAction } from '@/app/revenue/actions'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'

export function AddEventDialog({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      try {
        await addRevenueEventAction(formData)
        toast.success('Revenue event added')
        setOpen(false)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to add event')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" /> Add Event
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Revenue Event</DialogTitle>
          <DialogDescription className="sr-only">Record a new revenue event for a client</DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-3">
          <div className="space-y-1">
            <Label>Client</Label>
            <Select name="client_id" required>
              <SelectTrigger>
                <SelectValue placeholder="Select client..." />
              </SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.business_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label>Type</Label>
            <Select name="type" required>
              <SelectTrigger>
                <SelectValue placeholder="Select type..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="final">Final Payment</SelectItem>
                <SelectItem value="retainer">Retainer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="amount">Amount ($)</Label>
              <Input id="amount" name="amount" type="number" step="0.01" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="date">Date</Label>
              <Input id="date" name="date" type="date" required />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          <Button type="submit" disabled={isPending} className="w-full">
            {isPending ? 'Adding...' : 'Add Event'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
