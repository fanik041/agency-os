'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const PER_PAGE_OPTIONS = ['25', '50', '100']

export function PaginationControls({
  totalCount,
  page,
  perPage,
}: {
  totalCount: number
  page: number
  perPage: number
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const totalPages = Math.max(1, Math.ceil(totalCount / perPage))

  if (totalCount <= perPage && page === 1) return null

  const from = (page - 1) * perPage + 1
  const to = Math.min(page * perPage, totalCount)

  function setParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString())
    for (const [key, value] of Object.entries(updates)) {
      if (value === null) {
        params.delete(key)
      } else {
        params.set(key, value)
      }
    }
    router.push(`/leads?${params.toString()}`)
  }

  function goToPage(p: number) {
    setParams({ page: p <= 1 ? null : String(p) })
  }

  function changePerPage(value: string) {
    setParams({ per_page: value === '50' ? null : value, page: null })
  }

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Showing {from}–{to} of {totalCount}
      </p>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="text-sm text-muted-foreground">Per page</span>
          <Select value={String(perPage)} onValueChange={changePerPage}>
            <SelectTrigger className="w-20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((v) => (
                <SelectItem key={v} value={v}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => goToPage(page - 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => goToPage(page + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
