'use client'

import { Popover } from 'radix-ui'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { exportLeadsCrmCsvAction } from '@/app/crm/actions'
import { CRM_COLUMNS } from '@/lib/crm-columns'

export function CrmToolbar({
  count,
  visibleFields,
  onVisibilityChange,
  onNewClick,
  onImportClick,
}: {
  count: number
  visibleFields: Set<string>
  onVisibilityChange: (next: Set<string>) => void
  onNewClick: () => void
  onImportClick: () => void
}) {
  const router = useRouter()
  const params = useSearchParams()
  const [pending, startTransition] = useTransition()
  const [search, setSearch] = useState(params.get('q') ?? '')
  const showDeleted = params.get('show_deleted') === '1'

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    next.delete('page')
    startTransition(() => router.push(`/crm?${next.toString()}`))
  }

  async function exportCsv() {
    try {
      const res = await exportLeadsCrmCsvAction({
        search: params.get('q') ?? undefined,
        includeDeleted: showDeleted,
      })
      if (!res.ok) {
        toast.error('Export failed')
        return
      }
      const blob = new Blob([res.csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = res.filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${res.rowCount} leads`)
    } catch (err) {
      toast.error(`Export failed: ${String(err)}`)
    }
  }

  function resetVisibility() {
    onVisibilityChange(new Set(CRM_COLUMNS.filter(c => c.defaultVisible).map(c => c.field as string)))
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        value={search}
        onChange={e => {
          setSearch(e.target.value)
          setParam('q', e.target.value || null)
        }}
        placeholder="Search name / phone / email / website / city / niche"
        className="w-80 rounded border border-[#dadde1] px-2 py-1 text-sm"
      />
      <label className="flex items-center gap-1 text-sm">
        <input
          type="checkbox"
          checked={showDeleted}
          onChange={e => setParam('show_deleted', e.target.checked ? '1' : null)}
        />
        Show deleted
      </label>
      <Popover.Root>
        <Popover.Trigger asChild>
          <button className="rounded border border-[#dadde1] px-3 py-1 text-sm">Columns</button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content className="z-50 max-h-80 w-56 overflow-y-auto rounded border border-[#dadde1] bg-white p-2 shadow-lg">
            {CRM_COLUMNS.map(c => (
              <label key={c.field as string} className="flex items-center gap-2 px-1 py-0.5 text-sm">
                <input
                  type="checkbox"
                  checked={visibleFields.has(c.field as string)}
                  onChange={e => {
                    const next = new Set(visibleFields)
                    if (e.target.checked) next.add(c.field as string)
                    else next.delete(c.field as string)
                    onVisibilityChange(next)
                  }}
                />
                {c.label}
              </label>
            ))}
            <button
              onClick={resetVisibility}
              className="mt-1 w-full rounded border border-[#dadde1] py-0.5 text-xs"
            >
              Reset to default
            </button>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <div className="ml-auto flex items-center gap-2">
        <span className="text-sm text-muted-foreground">{count} leads{pending && ' …'}</span>
        <button onClick={exportCsv} className="rounded border border-[#dadde1] px-3 py-1 text-sm">Export</button>
        <button onClick={onImportClick} className="rounded border border-[#dadde1] px-3 py-1 text-sm">Import CSV</button>
        <button onClick={onNewClick} className="rounded bg-[#1c1e21] px-3 py-1 text-sm text-white">+ New</button>
      </div>
    </div>
  )
}
