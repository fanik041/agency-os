'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { syncToAttioAction } from '@/app/leads/actions'

export function SyncAttioButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<string[]>([])
  const [stats, setStats] = useState<{ total: number; pushed: number; skipped: number; failed: number } | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleSync() {
    setLoading(true)
    setError(null)
    setLogs([])
    setStats(null)
    setOpen(true)

    try {
      const result = await syncToAttioAction()
      console.log('[sync-button] result:', result)
      setLogs(result.logs)
      setStats(result.stats)
      if (!result.ok) setError(result.error ?? 'Unknown error')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleSync} disabled={loading} size="sm" variant="outline">
        {loading ? 'Syncing...' : 'Sync to Attio'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Syncing to Attio...' : error ? 'Sync Error' : 'Sync Complete'}
            </DialogTitle>
            <DialogDescription>
              {loading
                ? 'Comparing Supabase leads with Attio and pushing missing entries...'
                : error
                  ? error
                  : stats
                    ? `${stats.total} leads checked — ${stats.pushed} pushed, ${stats.skipped} already existed, ${stats.failed} failed`
                    : 'Done'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0 bg-zinc-950 border border-zinc-800 rounded-lg p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap">
            {loading && logs.length === 0 && (
              <span className="text-zinc-500">Connecting...</span>
            )}
            {logs.map((line, i) => (
              <div
                key={i}
                className={
                  line.includes('FAIL') || line.includes('ERROR')
                    ? 'text-red-400'
                    : line.includes('OK')
                      ? 'text-green-400'
                      : line.startsWith('Done')
                        ? 'text-blue-400 font-bold'
                        : 'text-zinc-300'
                }
              >
                {line}
              </div>
            ))}
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
