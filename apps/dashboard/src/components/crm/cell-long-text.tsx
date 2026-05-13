'use client'

import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { updateLeadFieldAction } from '@/app/crm/actions'

export function CellLongText({
  leadId,
  field,
  initial,
}: {
  leadId: string
  field: string
  initial: string | null
}) {
  const [value, setValue] = useState<string>(initial ?? '')
  const [open, setOpen] = useState(false)
  const lastSaved = useRef<string>(initial ?? '')
  // No truncation — let the cell wrap freely


  async function save() {
    if (value === lastSaved.current) {
      setOpen(false)
      return
    }
    try {
      const res = await updateLeadFieldAction(leadId, field, value || null)
      if (!('ok' in res) || !res.ok) throw new Error('save failed')
      lastSaved.current = value
      setOpen(false)
    } catch (err) {
      toast.error(`Failed to save ${field}: ${String(err)}`)
    }
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="block w-full whitespace-pre-wrap break-words bg-white px-1 py-0.5 text-left leading-snug hover:bg-[#f7f8fa]">
          {value || <span className="text-muted-foreground">—</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 w-[420px] rounded border border-[#dadde1] bg-white p-3 shadow-lg">
          <textarea
            value={value}
            onChange={e => setValue(e.target.value)}
            className="h-40 w-full resize-y rounded border border-[#dadde1] p-2 text-sm"
            autoFocus
          />
          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setValue(lastSaved.current)
                setOpen(false)
              }}
              className="rounded border border-[#dadde1] px-3 py-1 text-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded bg-[#1c1e21] px-3 py-1 text-sm text-white"
            >
              Save
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
