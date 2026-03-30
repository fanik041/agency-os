'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type LogType = 'info' | 'success' | 'error' | 'warn' | 'done' | 'contact'

const colorMap: Record<LogType, string> = {
  info: 'text-zinc-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
  done: 'text-blue-400 font-bold',
  contact: 'text-emerald-400',
}

const MAX_RETRIES = 5

export function ResearchLogModal({
  open,
  onOpenChange,
  leadIds,
  onComplete,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  leadIds: string[]
  onComplete?: () => void
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<{ text: string; type: LogType }[]>([])
  const [stats, setStats] = useState<{ processed: number; contactsFound: number; total: number } | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((text: string, type: LogType = 'info') => {
    setLogs(prev => [...prev, { text, type }])
  }, [])

  useEffect(() => {
    if (!open || leadIds.length === 0 || startedRef.current) return
    startedRef.current = true

    async function streamResearch(ids: string[]): Promise<{ processedIds: Set<string>; receivedDone: boolean }> {
      const processedIds = new Set<string>()
      let receivedDone = false

      try {
        const resp = await fetch('/api/research/stream', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadIds: ids }),
        })

        if (!resp.ok) {
          const err = await resp.json().catch(() => ({ error: 'Request failed' }))
          addLog(`Error: ${err.error || resp.statusText}`, 'error')
          return { processedIds, receivedDone: false }
        }

        if (!resp.body) {
          addLog('Error: No response stream', 'error')
          return { processedIds, receivedDone: false }
        }

        const reader = resp.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''

        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() || ''

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            try {
              const evt = JSON.parse(line.slice(6))
              const type = evt.type as string

              if (type === 'log') {
                addLog(evt.message, 'info')
                // Track processed leads from log messages like "[X/Y] ... "lead name"..."
                const match = evt.message.match(/Done — \d+ contacts \((\d+)\/\d+ leads processed\)/)
                if (match) {
                  const idx = parseInt(match[1], 10) - 1
                  if (idx >= 0 && idx < ids.length) {
                    processedIds.add(ids[idx])
                  }
                }
              } else if (type === 'warn') {
                addLog(evt.message, 'warn')
              } else if (type === 'error') {
                addLog(evt.message, 'error')
              } else if (type === 'contact') {
                addLog(evt.message, 'contact')
              } else if (type === 'done') {
                receivedDone = true
                addLog(evt.message, 'done')
                if (evt.data) {
                  setStats({
                    processed: evt.data.processed,
                    contactsFound: evt.data.contactsFound,
                    total: leadIds.length,
                  })
                }
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }
      } catch (err) {
        addLog(`Connection error: ${err instanceof Error ? err.message : String(err)}`, 'error')
      }

      return { processedIds, receivedDone }
    }

    async function runResearch() {
      setLoading(true)
      setLogs([])
      setStats(null)

      addLog(`Starting research for ${leadIds.length} lead(s)...`)

      let remainingIds = [...leadIds]
      let retryCount = 0

      while (retryCount < MAX_RETRIES) {
        const { processedIds, receivedDone } = await streamResearch(remainingIds)

        if (receivedDone) break

        // Stream ended without "done" — connection dropped
        remainingIds = remainingIds.filter(id => !processedIds.has(id))

        if (remainingIds.length === 0) {
          addLog('All leads processed.', 'done')
          break
        }

        retryCount++
        addLog(`Connection dropped. Resuming with ${remainingIds.length} remaining lead(s)... (retry ${retryCount}/${MAX_RETRIES})`, 'warn')

        // Brief pause before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }

      if (retryCount >= MAX_RETRIES) {
        addLog(`Max retries reached. ${remainingIds.length} lead(s) were not processed.`, 'error')
      }

      setLoading(false)
      router.refresh()
      onComplete?.()
    }

    runResearch()
  }, [open, leadIds, addLog, router, onComplete])

  function handleOpenChange(value: boolean) {
    // Prevent dismissal while loading — clicking outside or pressing Escape does nothing
    if (loading && !value) return
    if (!value) startedRef.current = false
    onOpenChange(value)
  }

  const progressText = () => {
    if (loading && !stats) return `Researching ${leadIds.length} lead(s)...`
    if (loading && stats) return `Progress: ${stats.processed}/${stats.total} leads — ${stats.contactsFound} contacts found`
    if (stats) return `Done — ${stats.processed} leads processed, ${stats.contactsFound} contacts found`
    return 'Done'
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onPointerDownOutside={(e) => { if (loading) e.preventDefault() }} onEscapeKeyDown={(e) => { if (loading) e.preventDefault() }}>
        <DialogHeader>
          <DialogTitle>
            {loading ? 'Researching Contacts...' : 'Research Complete'}
          </DialogTitle>
          <DialogDescription>
            {progressText()}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-950 border border-zinc-800 rounded-lg p-4 h-80 font-mono text-xs leading-relaxed whitespace-pre-wrap">
          {logs.map((entry, i) => (
            <div key={i} className={colorMap[entry.type]}>
              {entry.text}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>

        {!loading && (
          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => onOpenChange(false)}>Close</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
