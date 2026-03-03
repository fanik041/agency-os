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

const CALL_STATUSES = ['pending', 'called', 'callback', 'interested', 'closed', 'dead'] as const
const QUALITY_LEVELS = [
  { value: '3', label: '3+ (Decent)' },
  { value: '4', label: '4+ (Poor site)' },
  { value: '5', label: '5 (No site)' },
]

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
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search leads..."
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-52 pl-8"
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

      <Select value={searchParams.get('call_status') ?? 'all'} onValueChange={(v) => setParam('call_status', v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Statuses</SelectItem>
          {CALL_STATUSES.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={searchParams.get('min_quality') ?? 'all'} onValueChange={(v) => setParam('min_quality', v)}>
        <SelectTrigger className="w-36">
          <SelectValue placeholder="Quality" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Any Quality</SelectItem>
          {QUALITY_LEVELS.map((q) => (
            <SelectItem key={q.value} value={q.value}>{q.label}</SelectItem>
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
