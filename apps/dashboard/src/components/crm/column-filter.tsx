'use client'

import { Popover } from 'radix-ui'
import { useEffect, useState } from 'react'
import { getDistinctLeadValuesAction } from '@/app/crm/actions'

export function ColumnFilter({
  field,
  selected,
  onChange,
}: {
  field: 'status' | 'city' | 'niche'
  selected: string[]
  onChange: (next: string[]) => void
}) {
  const [options, setOptions] = useState<string[]>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (open && options.length === 0) {
      getDistinctLeadValuesAction(field).then(r => r.ok && setOptions(r.values))
    }
  }, [open, options.length, field])

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className={`ml-1 rounded px-1 text-xs ${selected.length ? 'bg-[#0ea5e9] text-white' : 'text-muted-foreground'}`}>⏷</button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content className="z-50 w-56 rounded border border-[#dadde1] bg-white p-2 shadow-lg">
          {options.map(v => (
            <label key={v} className="flex items-center gap-2 px-1 py-0.5 text-sm hover:bg-[#f7f8fa]">
              <input
                type="checkbox"
                checked={selected.includes(v)}
                onChange={e => {
                  if (e.target.checked) onChange([...selected, v])
                  else onChange(selected.filter(x => x !== v))
                }}
              />
              {v}
            </label>
          ))}
          {selected.length > 0 && (
            <button onClick={() => onChange([])} className="mt-1 w-full rounded border border-[#dadde1] py-0.5 text-xs">
              Clear filter
            </button>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
