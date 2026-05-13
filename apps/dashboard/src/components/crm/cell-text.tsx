'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { updateLeadFieldAction } from '@/app/crm/actions'

export function CellText({
  leadId,
  field,
  initial,
  type,
}: {
  leadId: string
  field: string
  initial: string | number | null
  type: 'text' | 'number'
}) {
  const [value, setValue] = useState<string>(initial == null ? '' : String(initial))
  const [error, setError] = useState(false)
  const lastSaved = useRef<string>(initial == null ? '' : String(initial))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    setValue(initial == null ? '' : String(initial))
    lastSaved.current = initial == null ? '' : String(initial)
  }, [initial])

  // Auto-resize textarea to fit content
  useLayoutEffect(() => {
    if (type === 'text' && taRef.current) {
      taRef.current.style.height = 'auto'
      taRef.current.style.height = `${taRef.current.scrollHeight}px`
    }
  }, [value, type])

  function scheduleSave(next: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => save(next), 500)
  }

  async function save(next: string) {
    if (next === lastSaved.current) return
    const parsedValue = type === 'number'
      ? (next === '' ? null : Number(next))
      : (next === '' ? null : next)
    try {
      const res = await updateLeadFieldAction(leadId, field, parsedValue)
      if (!('ok' in res) || !res.ok) throw new Error('save failed')
      lastSaved.current = next
      setError(false)
    } catch (err) {
      setError(true)
      toast.error(`Failed to save ${field}: ${String(err)}`)
      setValue(lastSaved.current)
    }
  }

  if (type === 'number') {
    return (
      <input
        ref={inputRef}
        value={value}
        onChange={e => {
          setValue(e.target.value)
          scheduleSave(e.target.value)
        }}
        onBlur={() => save(value)}
        onKeyDown={e => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
          if (e.key === 'Escape') {
            setValue(lastSaved.current)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className={cn(
          'w-full bg-white px-1 py-0.5 outline-none ring-1 ring-transparent focus:ring-[#0ea5e9]',
          error && 'ring-1 ring-red-500 bg-red-50',
        )}
        inputMode="numeric"
      />
    )
  }

  return (
    <textarea
      ref={taRef}
      value={value}
      rows={1}
      onChange={e => {
        setValue(e.target.value)
        scheduleSave(e.target.value)
      }}
      onBlur={() => save(value)}
      onKeyDown={e => {
        // Enter without shift = blur (save). Shift+Enter inserts newline.
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault()
          ;(e.target as HTMLTextAreaElement).blur()
        }
        if (e.key === 'Escape') {
          setValue(lastSaved.current)
          ;(e.target as HTMLTextAreaElement).blur()
        }
      }}
      className={cn(
        'block w-full resize-none overflow-hidden whitespace-pre-wrap break-words bg-white px-1 py-0.5 leading-snug outline-none ring-1 ring-transparent focus:ring-[#0ea5e9]',
        error && 'ring-1 ring-red-500 bg-red-50',
      )}
    />
  )
}
