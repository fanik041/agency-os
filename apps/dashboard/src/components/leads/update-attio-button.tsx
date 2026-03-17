'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { compareAttioAction, updateSingleAttioEntryAction } from '@/app/leads/actions'
import type { AttioDiffEntry } from '@/app/leads/actions'

export function UpdateAttioButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<{ text: string; type: 'info' | 'success' | 'error' | 'warn' | 'done' }[]>([])
  const [stats, setStats] = useState<{ updated: number; failed: number; total: number } | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (text: string, type: 'info' | 'success' | 'error' | 'warn' | 'done' = 'info') => {
    setLogs(prev => [...prev, { text, type }])
  }

  async function handleUpdate() {
    setLoading(true)
    setLogs([])
    setStats(null)
    setOpen(true)

    addLog('Comparing Supabase with Attio...')

    try {
      // Step 1: Compare
      const compare = await compareAttioAction()

      if (!compare.ok) {
        addLog(`Error: ${compare.error}`, 'error')
        setLoading(false)
        return
      }

      addLog(`${compare.diffs.length} entries need updating, ${compare.unchanged} unchanged, ${compare.unmatched} not in Attio`)

      if (compare.diffs.length === 0) {
        addLog('Everything is in sync!', 'done')
        setStats({ updated: 0, failed: 0, total: 0 })
        setLoading(false)
        return
      }

      // Step 2: Update one at a time with live progress
      let updated = 0
      let failed = 0

      for (let i = 0; i < compare.diffs.length; i++) {
        const entry = compare.diffs[i]
        addLog(`[${i + 1}/${compare.diffs.length}] "${entry.leadName}" — ${entry.diffs.length} fields: ${entry.diffs.join(', ')}`, 'warn')

        const result = await updateSingleAttioEntryAction({
          leadId: entry.leadId,
          recordId: entry.recordId,
          entryValues: entry.entryValues,
        })

        if (result.ok) {
          addLog(`  Updated`, 'success')
          updated++
        } else {
          addLog(`  FAIL: ${result.error}`, 'error')
          failed++
        }

        setStats({ updated, failed, total: compare.diffs.length })
      }

      addLog(`Done — ${updated} updated, ${failed} failed`, 'done')
    } catch (err) {
      addLog(`Fatal error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const colorMap = {
    info: 'text-zinc-300',
    success: 'text-green-400',
    error: 'text-red-400',
    warn: 'text-yellow-400',
    done: 'text-blue-400 font-bold',
  }

  return (
    <>
      <Button onClick={handleUpdate} disabled={loading} size="sm" variant="outline">
        {loading ? 'Updating...' : 'Update Attio'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Updating Attio...' : 'Update Complete'}
            </DialogTitle>
            <DialogDescription>
              {loading
                ? stats
                  ? `Progress: ${stats.updated + stats.failed}/${stats.total} — ${stats.updated} updated, ${stats.failed} failed`
                  : 'Comparing fields between Supabase and Attio...'
                : stats
                  ? `${stats.total} entries processed — ${stats.updated} updated, ${stats.failed} failed`
                  : 'Done'}
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
