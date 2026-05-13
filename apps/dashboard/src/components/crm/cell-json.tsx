'use client'

import { Popover } from 'radix-ui'
import { useMemo, useRef, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { updateLeadFieldAction } from '@/app/crm/actions'
import { cn } from '@/lib/utils'

export function CellJson({
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

  const { pretty, parseError, summary } = useMemo(() => {
    const raw = value
    if (!raw || !raw.trim()) return { pretty: '', parseError: null as string | null, summary: '—' }
    try {
      const parsed = JSON.parse(raw)
      const isObj = parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      const keys = isObj ? Object.keys(parsed as Record<string, unknown>) : []
      const summaryText = isObj
        ? `${keys.length} fields${keys.length > 0 ? ` · ${keys.slice(0, 3).join(', ')}${keys.length > 3 ? '…' : ''}` : ''}`
        : Array.isArray(parsed)
          ? `Array (${parsed.length} items)`
          : String(parsed).slice(0, 60)
      return {
        pretty: JSON.stringify(parsed, null, 2),
        parseError: null as string | null,
        summary: summaryText,
      }
    } catch (err) {
      return {
        pretty: raw,
        parseError: String(err),
        summary: `Invalid JSON · ${raw.slice(0, 40)}`,
      }
    }
  }, [value])

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
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[#1c1e21] hover:bg-[#f7f8fa]"
      >
        <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 transition-transform', open && 'rotate-90')} />
        <span className={cn('truncate', parseError && 'text-amber-700')}>{summary}</span>
      </button>
      {open && (
        <div className="mt-1 rounded border border-[#dadde1] bg-[#f7f8fa] p-2">
          {parseError && (
            <div className="mb-1 text-amber-700">⚠ Could not parse JSON: {parseError}</div>
          )}
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-snug">{pretty}</pre>
          <div className="mt-1 flex justify-end">
            <Popover.Root open={editOpen} onOpenChange={setEditOpen}>
              <Popover.Trigger asChild>
                <button className="rounded border border-[#dadde1] bg-white px-2 py-0.5 text-xs hover:bg-white">Edit raw</button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content className="z-50 w-[520px] rounded border border-[#dadde1] bg-white p-3 shadow-lg">
                  <textarea
                    value={value}
                    onChange={e => setValue(e.target.value)}
                    className="h-64 w-full resize-y rounded border border-[#dadde1] p-2 font-mono text-xs"
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
