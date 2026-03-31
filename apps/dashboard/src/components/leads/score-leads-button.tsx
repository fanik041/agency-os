'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { checkScoringLimitAction } from '@/app/leads/actions'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

type LogType = 'info' | 'success' | 'error' | 'warn' | 'done' | 'scored'

const colorMap: Record<LogType, string> = {
  info: 'text-zinc-300',
  success: 'text-green-400',
  error: 'text-red-400',
  warn: 'text-yellow-400',
  done: 'text-blue-400 font-bold',
  scored: 'text-emerald-400',
}

interface ScoringStats {
  scored: number
  skipped: number
  failed: number
  totalProducts: number
}

const MAX_RETRIES = 5

export function ScoreLeadsButton({ leadIds }: { leadIds?: string[] } = {}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<{ text: string; type: LogType }[]>([])
  const [stats, setStats] = useState<ScoringStats | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)
  const startedRef = useRef(false)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = useCallback((text: string, type: LogType = 'info') => {
    setLogs(prev => [...prev, { text, type }])
  }, [])

  async function streamScoring(): Promise<boolean> {
    let receivedDone = false

    try {
      const resp = await fetch('/api/score/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(leadIds?.length ? { leadIds } : {}),
      })

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: `HTTP ${resp.status} ${resp.statusText}` }))
        addLog(`Error (${resp.status}): ${err.error}`, 'error')
        return false
      }

      if (!resp.body) {
        addLog('Error: No response stream', 'error')
        return false
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

            if (type === 'info') {
              addLog(evt.message, 'info')
            } else if (type === 'warn') {
              addLog(evt.message, 'warn')
            } else if (type === 'error') {
              addLog(evt.message, 'error')
            } else if (type === 'scored') {
              addLog(evt.message, 'scored')
            } else if (type === 'done') {
              receivedDone = true
              addLog(evt.message, 'done')
              if (evt.data) {
                setStats({
                  scored: evt.data.scored,
                  skipped: evt.data.skipped,
                  failed: evt.data.failed,
                  totalProducts: evt.data.totalProducts,
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

    return receivedDone
  }

  async function handleScore() {
    if (startedRef.current) return
    startedRef.current = true
    setLoading(true)
    setLogs([])
    setStats(null)
    setOpen(true)

    // Check tier limits
    const limitResult = await checkScoringLimitAction()
    if (!limitResult.allowed) {
      addLog(`Blocked: ${limitResult.reason}`, 'error')
      setLoading(false)
      startedRef.current = false
      return
    }
    if (limitResult.cost_cents && limitResult.cost_cents > 0) {
      addLog(`Cost: $${(limitResult.cost_cents / 100).toFixed(2)} per lead scored (Per Use plan)`)
    }

    addLog('Connecting to scoring pipeline...')

    let retryCount = 0

    while (retryCount < MAX_RETRIES) {
      const receivedDone = await streamScoring()

      if (receivedDone) break

      retryCount++
      // Scoring endpoint auto-skips already-scored leads, so retrying picks up where it left off
      addLog(`Connection dropped. Resuming scoring... (retry ${retryCount}/${MAX_RETRIES})`, 'warn')
      await new Promise(resolve => setTimeout(resolve, 2000))
    }

    if (retryCount >= MAX_RETRIES) {
      addLog('Max retries reached. Some leads may not have been scored.', 'error')
    }

    setLoading(false)
    startedRef.current = false
    router.refresh()
  }

  function handleOpenChange(value: boolean) {
    if (loading && !value) return
    setOpen(value)
  }

  const progressText = () => {
    if (loading && !stats) return 'Scoring leads with AI...'
    if (stats) {
      const parts: string[] = []
      if (stats.scored > 0) parts.push(`${stats.scored} scored`)
      if (stats.skipped > 0) parts.push(`${stats.skipped} skipped`)
      if (stats.failed > 0) parts.push(`${stats.failed} failed`)
      if (stats.totalProducts > 0) parts.push(`${stats.totalProducts} products recommended`)
      return parts.join(' | ')
    }
    return 'Done'
  }

  return (
    <>
      <Button onClick={handleScore} disabled={loading} size="sm" variant="outline">
        {loading ? 'Scoring...' : 'Score Leads'}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onPointerDownOutside={(e) => { if (loading) e.preventDefault() }} onEscapeKeyDown={(e) => { if (loading) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Scoring Leads with AI...' : 'Scoring Complete'}
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
              <Button size="sm" onClick={() => setOpen(false)}>Close</Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
