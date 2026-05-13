'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import type { Lead, LeadStatus } from '@agency-os/db'
import { listLeadsForCrmAction } from './actions'
import { CrmTable, type SortState, type ColumnFilters } from '@/components/crm/crm-table'
import { CrmToolbar } from '@/components/crm/crm-toolbar'
import { BulkActionBar } from '@/components/crm/bulk-action-bar'
import { LeadEditDrawer } from '@/components/crm/lead-edit-drawer'
import { ImportCsvDialog } from '@/components/crm/import-csv-dialog'
import { CRM_COLUMNS } from '@/lib/crm-columns'

const DEFAULT_VISIBLE = new Set(CRM_COLUMNS.filter(c => c.defaultVisible).map(c => c.field as string))

export function CrmClient() {
  const router = useRouter()
  const params = useSearchParams()

  const [data, setData] = useState<Lead[]>([])
  const [count, setCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [visibleFields, setVisibleFields] = useState<Set<string>>(DEFAULT_VISIBLE)
  const [sort, setSort] = useState<SortState | null>(null)
  const [filters, setFilters] = useState<ColumnFilters>({ status: [], city: [], niche: [] })
  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

  const page = Math.max(1, parseInt(params.get('page') ?? '1', 10))
  const pageSize = Math.max(1, parseInt(params.get('per_page') ?? '100', 10))
  const search = params.get('q') ?? ''
  const showDeleted = params.get('show_deleted') === '1'

  function setUrlParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/crm?${next.toString()}`)
  }

  const totalPages = Math.max(1, Math.ceil(count / pageSize))
  const safePage = Math.min(page, totalPages)
  const fromRow = count === 0 ? 0 : (safePage - 1) * pageSize + 1
  const toRow = Math.min(count, safePage * pageSize)

  // Restore column visibility from localStorage on mount
  useEffect(() => {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('crm.hiddenColumns') : null
    if (stored) {
      try {
        const hidden: string[] = JSON.parse(stored)
        const next = new Set(CRM_COLUMNS.map(c => c.field as string))
        for (const f of hidden) next.delete(f)
        setVisibleFields(next)
      } catch {
        /* ignore */
      }
    }
  }, [])

  function persistVisible(next: Set<string>) {
    setVisibleFields(next)
    const hidden = CRM_COLUMNS.filter(c => !next.has(c.field as string)).map(c => c.field as string)
    if (typeof window !== 'undefined') {
      localStorage.setItem('crm.hiddenColumns', JSON.stringify(hidden))
    }
  }

  const reload = useCallback(async () => {
    setLoading(true)
    const res = await listLeadsForCrmAction({
      page,
      pageSize,
      search: search || undefined,
      sortField: sort?.field,
      sortDir: sort?.dir,
      statusFilter: filters.status.length ? (filters.status as LeadStatus[]) : undefined,
      cityFilter: filters.city.length ? filters.city : undefined,
      nicheFilter: filters.niche.length ? filters.niche : undefined,
      includeDeleted: showDeleted,
    })
    if (res.ok) {
      setData(res.data)
      setCount(res.count)
      setSelected(new Set())
    }
    setLoading(false)
  }, [page, pageSize, search, showDeleted, sort, filters])

  useEffect(() => {
    reload()
  }, [reload])

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-[#1c1e21]">CRM</h1>
      <BulkActionBar
        selected={[...selected]}
        showDeleted={showDeleted}
        onClear={() => setSelected(new Set())}
        onDone={reload}
      />
      <CrmToolbar
        count={count}
        visibleFields={visibleFields}
        onVisibilityChange={persistVisible}
        onNewClick={() => setCreateOpen(true)}
        onImportClick={() => setImportOpen(true)}
      />
      {loading && data.length === 0 ? (
        <div className="rounded border border-[#dadde1] bg-white p-6 text-sm text-muted-foreground">Loading…</div>
      ) : (
        <CrmTable
          data={data}
          visibleFields={visibleFields}
          sort={sort}
          onSortChange={setSort}
          selected={selected}
          onSelectedChange={setSelected}
          filters={filters}
          onFiltersChange={setFilters}
          onRowDone={reload}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-[#1c1e21]">
        <div className="text-muted-foreground">
          {count === 0 ? 'No leads' : `Showing ${fromRow}–${toRow} of ${count}`}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-muted-foreground">Per page</span>
            <select
              value={pageSize}
              onChange={e => {
                setUrlParam('per_page', e.target.value)
                setUrlParam('page', '1')
              }}
              className="rounded border border-[#dadde1] px-2 py-0.5"
            >
              {[50, 100, 200].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <button
            onClick={() => setUrlParam('page', String(Math.max(1, safePage - 1)))}
            disabled={safePage <= 1}
            className="rounded border border-[#dadde1] px-3 py-0.5 disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-muted-foreground">
            Page {safePage} of {totalPages}
          </span>
          <button
            onClick={() => setUrlParam('page', String(Math.min(totalPages, safePage + 1)))}
            disabled={safePage >= totalPages}
            className="rounded border border-[#dadde1] px-3 py-0.5 disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      </div>
      <LeadEditDrawer
        mode="create"
        open={createOpen}
        onOpenChange={setCreateOpen}
        onDone={() => {
          router.refresh()
          reload()
        }}
      />
      <ImportCsvDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onDone={() => {
          router.refresh()
          reload()
        }}
      />
    </div>
  )
}
