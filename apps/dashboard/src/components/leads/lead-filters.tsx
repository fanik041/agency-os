'use client'

import { useRef, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import type { LeadSource } from '@agency-os/db'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const LEAD_STATUSES = ['new', 'scoring', 'needs_review', 'approved', 'sent', 'replied', 'booked', 'closed', 'skip'] as const

export function LeadFilters({
  niches,
  cities,
  sources,
}: {
  niches: string[]
  cities: string[]
  sources: LeadSource[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [searchValue, setSearchValue] = useState(searchParams.get('q') ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Sync search value when URL changes externally
  useEffect(() => {
    setSearchValue(searchParams.get('q') ?? '')
  }, [searchParams])

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    if (value === 'all' || value === '') {
      params.delete(key)
    } else {
      params.set(key, value)
    }
    // Reset to page 1 when filters change
    params.delete('page')
    router.push(`/leads?${params.toString()}`)
  }

  function handleSearchChange(value: string) {
    setSearchValue(value)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setParam('q', value)
    }, 300)
  }

  return (
    <div className="flex flex-wrap gap-2">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#65676b]" />
        <Input
          placeholder="Search leads..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-52 pl-9 rounded-full bg-[#f0f2f5] border-transparent focus:border-[#1877f2] focus:bg-white"
        />
      </div>

      <Select value={searchParams.get('niche') ?? 'all'} onValueChange={(v) => setParam('niche', v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Niche" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Niches</SelectItem>
          {niches.map((n) => (
            <SelectItem key={n} value={n}>{n}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get('city') ?? 'all'} onValueChange={(v) => setParam('city', v)}>
        <SelectTrigger className="w-40">
          <SelectValue placeholder="City" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Cities</SelectItem>
          {cities.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get('status') ?? 'all'} onValueChange={(v) => setParam('status', v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {LEAD_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {sources.length > 0 && (
        <Select value={searchParams.get('source_id') ?? 'all'} onValueChange={(v) => setParam('source_id', v)}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.type === 'scrape' ? '🔍 ' : s.type === 'import' ? '📥 ' : ''}{s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
