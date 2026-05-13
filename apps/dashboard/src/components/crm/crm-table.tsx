'use client'

import { useMemo } from 'react'
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table'
import type { Lead, LeadStatus } from '@agency-os/db'
import { CRM_COLUMNS } from '@/lib/crm-columns'
import { cn } from '@/lib/utils'
import { CellText } from './cell-text'
import { CellBoolean } from './cell-boolean'
import { CellStatus } from './cell-status'
import { CellLongText } from './cell-long-text'
import { CellJson } from './cell-json'
import { CellCollapsible } from './cell-collapsible'
import { ColumnFilter } from './column-filter'
import { ScoreRowButton } from './score-row-button'

export interface SortState {
  field: string
  dir: 'asc' | 'desc'
}

export interface ColumnFilters {
  status: string[]
  city: string[]
  niche: string[]
}

const CHECKBOX_COL_WIDTH = 44
const ACTIONS_COL_WIDTH = 80

function formatReadonly(raw: unknown): string {
  if (raw == null || raw === '') return '—'
  const s = String(raw)
  // ISO timestamp? e.g. "2026-03-05T03:48:06.734269+00:00"
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) {
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      const hh = String(d.getHours()).padStart(2, '0')
      const mi = String(d.getMinutes()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}`
    }
  }
  return s
}

// Right-edge shadow to delineate the pinned-region from scrolled content
const lastPinnedShadow = 'shadow-[inset_-1px_0_0_#dadde1,4px_0_6px_-4px_rgba(0,0,0,0.18)]'

export function CrmTable({
  data,
  visibleFields,
  sort,
  onSortChange,
  selected,
  onSelectedChange,
  filters,
  onFiltersChange,
  onRowDone,
}: {
  data: Lead[]
  visibleFields: Set<string>
  sort: SortState | null
  onSortChange: (next: SortState | null) => void
  selected: Set<string>
  onSelectedChange: (next: Set<string>) => void
  filters: ColumnFilters
  onFiltersChange: (next: ColumnFilters) => void
  onRowDone: () => void
}) {
  const visibleCols = useMemo(
    () => CRM_COLUMNS.filter(c => visibleFields.has(c.field as string)),
    [visibleFields],
  )

  const pinnedFields = useMemo(
    () => visibleCols.filter(c => c.pinned).map(c => c.field as string),
    [visibleCols],
  )

  const lastPinnedField = pinnedFields[pinnedFields.length - 1]

  // Sticky-left offset, computed from VISIBLE pinned columns (so hiding one updates positions correctly)
  function pinnedLeft(field: string): number {
    let left = CHECKBOX_COL_WIDTH
    for (const f of pinnedFields) {
      if (f === field) return left
      const col = visibleCols.find(c => c.field === f)!
      left += col.width
    }
    return left
  }

  const totalWidth = useMemo(
    () => CHECKBOX_COL_WIDTH + visibleCols.reduce((sum, c) => sum + c.width, 0) + ACTIONS_COL_WIDTH,
    [visibleCols],
  )

  const columns = useMemo<ColumnDef<Lead>[]>(() => {
    return visibleCols.map(c => ({
      id: c.field as string,
      accessorKey: c.field as string,
      header: c.label,
      size: c.width,
      meta: { pinned: c.pinned, type: c.type, sortable: c.sortable, filterable: c.filterable },
      cell: ({ row }) => {
        const lead = row.original
        const raw = (lead as unknown as Record<string, unknown>)[c.field as string]
        if (c.type === 'text') return <CellText leadId={lead.id} field={c.field as string} initial={raw as string | null} type="text" />
        if (c.type === 'number') return <CellText leadId={lead.id} field={c.field as string} initial={raw as number | null} type="number" />
        if (c.type === 'boolean') return <CellBoolean leadId={lead.id} field={c.field as string} initial={raw as boolean | null} />
        if (c.type === 'status') return <CellStatus leadId={lead.id} initial={raw as LeadStatus} />
        if (c.type === 'longtext') return <CellLongText leadId={lead.id} field={c.field as string} initial={raw as string | null} />
        if (c.type === 'collapsible') return <CellCollapsible leadId={lead.id} field={c.field as string} initial={raw as string | null} />
        if (c.type === 'json') return <CellJson leadId={lead.id} field={c.field as string} initial={raw as string | null} />
        if (c.type === 'date') return <span className="text-muted-foreground">{(raw as string | null) ?? '—'}</span>
        if (c.type === 'readonly') return <span className="text-muted-foreground">{formatReadonly(raw)}</span>
        return <span className="text-muted-foreground">{String(raw ?? '')}</span>
      },
    }))
  }, [visibleCols])

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  const allOnPageSelected = data.length > 0 && data.every(d => selected.has(d.id))

  function toggleSelectAll() {
    const next = new Set(selected)
    if (allOnPageSelected) for (const d of data) next.delete(d.id)
    else for (const d of data) next.add(d.id)
    onSelectedChange(next)
  }

  function toggleRow(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onSelectedChange(next)
  }

  function clickHeader(field: string, sortable: boolean | undefined) {
    if (!sortable) return
    if (sort?.field !== field) onSortChange({ field, dir: 'asc' })
    else if (sort.dir === 'asc') onSortChange({ field, dir: 'desc' })
    else onSortChange(null)
  }

  return (
    <div className="overflow-x-auto rounded border border-[#dadde1] bg-white">
      <table
        className="border-separate text-sm"
        style={{ tableLayout: 'fixed', borderSpacing: 0, width: totalWidth, minWidth: totalWidth }}
      >
        <colgroup>
          <col style={{ width: CHECKBOX_COL_WIDTH }} />
          {visibleCols.map(c => (
            <col key={c.field as string} style={{ width: c.width }} />
          ))}
          <col style={{ width: ACTIONS_COL_WIDTH }} />
        </colgroup>

        <thead className="bg-[#f7f8fa]">
          <tr>
            <th
              className="sticky left-0 z-30 border-b border-[#dadde1] bg-[#f7f8fa] px-3 py-2"
              style={{ width: CHECKBOX_COL_WIDTH }}
            >
              <input type="checkbox" checked={allOnPageSelected} onChange={toggleSelectAll} />
            </th>
            {table.getHeaderGroups()[0]?.headers.map(h => {
              const meta = h.column.columnDef.meta as { pinned?: boolean; sortable?: boolean; filterable?: boolean } | undefined
              const field = h.id
              const isFilterable = !!meta?.filterable
              const isSorted = sort?.field === field
              const isLastPinned = field === lastPinnedField
              return (
                <th
                  key={h.id}
                  className={cn(
                    'border-b border-[#dadde1] px-3 py-2 text-left font-medium text-[#1c1e21]',
                    meta?.pinned && 'sticky bg-[#f7f8fa] z-30',
                    isLastPinned && lastPinnedShadow,
                  )}
                  style={{ left: meta?.pinned ? pinnedLeft(field) : undefined }}
                >
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => clickHeader(field, meta?.sortable)}
                      className={cn('inline-flex items-center gap-1 truncate', meta?.sortable && 'cursor-pointer hover:underline')}
                      disabled={!meta?.sortable}
                    >
                      {flexRender(h.column.columnDef.header, h.getContext())}
                      {isSorted && (sort?.dir === 'asc' ? '↑' : '↓')}
                    </button>
                    {isFilterable && (field === 'status' || field === 'city' || field === 'niche') && (
                      <ColumnFilter
                        field={field}
                        selected={filters[field]}
                        onChange={next => onFiltersChange({ ...filters, [field]: next })}
                      />
                    )}
                  </div>
                </th>
              )
            })}
            <th
              className="border-b border-[#dadde1] px-2 py-2 text-left font-medium text-[#1c1e21]"
              style={{ width: ACTIONS_COL_WIDTH }}
            >
              Actions
            </th>
          </tr>
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id} className="group">
              <td
                className="sticky left-0 z-20 border-b border-[#eef0f2] bg-white px-3 py-2 align-top group-hover:bg-[#fafbfc]"
                style={{ width: CHECKBOX_COL_WIDTH }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(row.original.id)}
                  onChange={() => toggleRow(row.original.id)}
                  className="mt-1"
                />
              </td>
              {row.getVisibleCells().map(cell => {
                const meta = cell.column.columnDef.meta as { pinned?: boolean } | undefined
                const isLastPinned = cell.column.id === lastPinnedField
                return (
                  <td
                    key={cell.id}
                    className={cn(
                      'border-b border-[#eef0f2] bg-white px-2 py-1 align-top group-hover:bg-[#fafbfc]',
                      meta?.pinned && 'sticky z-20',
                      isLastPinned && lastPinnedShadow,
                    )}
                    style={{ left: meta?.pinned ? pinnedLeft(cell.column.id) : undefined }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                )
              })}
              <td className="border-b border-[#eef0f2] bg-white px-2 py-2 align-top group-hover:bg-[#fafbfc]">
                <ScoreRowButton leadId={row.original.id} onDone={onRowDone} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
