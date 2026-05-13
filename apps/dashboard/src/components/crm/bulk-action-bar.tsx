'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { LeadStatus } from '@agency-os/db'
import { bulkUpdateLeadsStatusAction, softDeleteLeadsAction, restoreLeadsAction } from '@/app/crm/actions'

export function BulkActionBar({
  selected,
  showDeleted,
  onClear,
  onDone,
}: {
  selected: string[]
  showDeleted: boolean
  onClear: () => void
  onDone: () => void
}) {
  const [confirming, setConfirming] = useState<'delete' | null>(null)

  async function bulkStatus(status: LeadStatus) {
    const res = await bulkUpdateLeadsStatusAction(selected, status)
    if (res.ok) {
      toast.success(`Set ${selected.length} → ${status}`)
      onDone()
    }
  }

  async function bulkDelete() {
    const ids = [...selected]
    const res = await softDeleteLeadsAction(ids)
    if (!res.ok) {
      toast.error('Delete failed')
      return
    }
    toast(`Deleted ${ids.length}`, {
      duration: 5000,
      action: {
        label: 'Undo',
        onClick: async () => {
          await restoreLeadsAction(ids)
          onDone()
        },
      },
    })
    onDone()
  }

  async function bulkRestore() {
    const ids = [...selected]
    const res = await restoreLeadsAction(ids)
    if (res.ok) {
      toast.success(`Restored ${ids.length}`)
      onDone()
    }
  }

  if (selected.length === 0) return null

  return (
    <div className="sticky top-0 z-20 flex items-center gap-2 rounded border border-[#dadde1] bg-[#1c1e21] px-3 py-2 text-sm text-white">
      <span>{selected.length} selected</span>
      <button onClick={onClear} className="rounded border border-white/30 px-2 py-0.5 text-xs">Clear</button>
      <select
        defaultValue=""
        onChange={e => {
          if (e.target.value) bulkStatus(e.target.value as LeadStatus)
          e.target.value = ''
        }}
        className="rounded bg-white px-2 py-0.5 text-xs text-[#1c1e21]"
      >
        <option value="">Set status…</option>
        {Object.values(LeadStatus).map(s => <option key={s} value={s}>{s}</option>)}
      </select>
      {showDeleted ? (
        <button onClick={bulkRestore} className="rounded bg-green-600 px-2 py-0.5 text-xs">Restore</button>
      ) : confirming === 'delete' ? (
        <>
          <button onClick={bulkDelete} className="rounded bg-red-600 px-2 py-0.5 text-xs">Confirm delete</button>
          <button onClick={() => setConfirming(null)} className="rounded border border-white/30 px-2 py-0.5 text-xs">Cancel</button>
        </>
      ) : (
        <button onClick={() => setConfirming('delete')} className="rounded bg-red-600 px-2 py-0.5 text-xs">Delete</button>
      )}
    </div>
  )
}
