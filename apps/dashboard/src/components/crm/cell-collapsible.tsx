'use client'

import { Popover } from 'radix-ui'
import { useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateLeadFieldAction } from '@/app/crm/actions'

const PREVIEW_CHARS = 60

export function CellCollapsible({
  leadId,
  field,
  initial,
}: {
  leadId: string
  field: string
  initial: string | null
}) {
  const [open, setOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [value, setValue] = useState<string>(initial ?? '')
  const lastSaved = useRef<string>(initial ?? '')

  const isEmpty = !value || !value.trim()
  const preview = isEmpty
    ? '—'
    : value.length > PREVIEW_CHARS
      ? value.slice(0, PREVIEW_CHARS).replace(/\s+/g, ' ').trim() + '…'
      : value.replace(/\s+/g, ' ').trim()

  async function save() {
    if (value === lastSaved.current) {
      setEditOpen(false)
      return
    }
    try {
      const res = await updateLeadFieldAction(leadId, field, value || null)
      if (!('ok' in res) || !res.ok) throw new Error('save failed')
      lastSaved.current = value
      setEditOpen(false)
    } catch (err) {
      toast.error(`Failed to save ${field}: ${String(err)}`)
    }
  }

  return (
    <div className="w-full text-xs">
      <button
        type="button"
        onClick={() => !isEmpty && setOpen(o => !o)}
        disabled={isEmpty}
        className={cn(
          'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[#1c1e21]',
          !isEmpty && 'hover:bg-[#f7f8fa]',
          isEmpty && 'text-muted-foreground',
        )}
      >
        <ChevronRight
          className={cn(
            'h-3.5 w-3.5 shrink-0 transition-transform',
            open && 'rotate-90',
            isEmpty && 'opacity-30',
          )}
        />
        <span className="truncate">{preview}</span>
      </button>
      {open && !isEmpty && (
        <div className="mt-1 rounded border border-[#dadde1] bg-[#f7f8fa] p-2">
          <div className="max-h-80 overflow-auto whitespace-pre-wrap break-words text-[12px] leading-snug">{value}</div>
          <div className="mt-1 flex justify-end">
            <Popover.Root open={editOpen} onOpenChange={setEditOpen}>
              <Popover.Trigger asChild>
                <button className="rounded border border-[#dadde1] bg-white px-2 py-0.5 text-xs hover:bg-white">Edit</button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="z-50 w-[520px] rounded border border-[#dadde1] bg-white p-3 shadow-lg">
                  <textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="h-64 w-full resize-y rounded border border-[#dadde1] p-2 text-sm"
                    autoFocus
                  />
                  <div className="mt-2 flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setValue(lastSaved.current)
                        setEditOpen(false)
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
          </div>
        </div>
      )}
    </div>
  )
}
