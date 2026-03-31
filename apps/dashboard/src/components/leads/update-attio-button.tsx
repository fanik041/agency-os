'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { compareAttioAction, updateSingleAttioEntryAction, createNewAttioEntryAction, checkAttioSyncLimitAction } from '@/app/leads/actions'

type LogType = 'info' | 'success' | 'error' | 'warn' | 'done' | 'detail'

export function SyncAttioButton() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [logs, setLogs] = useState<{ text: string; type: LogType }[]>([])
  const [stats, setStats] = useState<{
    created: number; updated: number; failed: number; total: number
  } | null>(null)
  const logEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs])

  const addLog = (text: string, type: LogType = 'info') => {
    setLogs(prev => [...prev, { text, type }])
  }

  async function handleSync() {
    setLoading(true)
    setLogs([])
    setStats(null)
    setOpen(true)

    // Check tier limits
    const limitResult = await checkAttioSyncLimitAction()
    if (!limitResult.allowed) {
      addLog(limitResult.reason ?? 'Attio sync not available on your plan', 'error')
      setLoading(false)
      return
    }
    if (limitResult.cost_cents && limitResult.cost_cents > 0) {
      addLog(`Cost: $${(limitResult.cost_cents / 100).toFixed(2)} per sync (Per Use plan)`)
    }

    addLog('Step 1: Fetching leads from Supabase and entries from Attio...')

    try {
      const compare = await compareAttioAction()

      if (!compare.ok) {
        addLog(`Error: ${compare.error}`, 'error')
        setLoading(false)
        return
      }

      // Detailed count summary
      addLog(`Supabase: ${compare.supabaseCount} leads`, 'info')
      addLog(`Attio: ${compare.attioCount} entries`, 'info')
      addLog(`Matched & unchanged: ${compare.unchanged}`, 'info')
      addLog(`Matched & need updating: ${compare.diffs.length}`, compare.diffs.length > 0 ? 'warn' : 'info')
      addLog(`Missing from Attio (new): ${compare.newEntries.length}`, compare.newEntries.length > 0 ? 'warn' : 'info')
      addLog('')

      const totalWork = compare.newEntries.length + compare.diffs.length
      const totalLeads = compare.supabaseCount

      if (totalWork === 0) {
        addLog('Everything is in sync!', 'done')
        setStats({ created: 0, updated: 0, failed: 0, total: 0 })
        setLoading(false)
        return
      }

      let created = 0
      let updated = 0
      let failed = 0
      let progress = 0

      // Phase 1: Create new entries in Attio
      if (compare.newEntries.length > 0) {
        addLog(`Step 2: Creating ${compare.newEntries.length} new companies in Attio...`)
        addLog('')

        for (let i = 0; i < compare.newEntries.length; i++) {
          const entry = compare.newEntries[i]
          progress++
          addLog(`[${progress}/${totalWork}/${totalLeads}] CREATE "${entry.leadName}"`, 'warn')

          // Log the fields being sent
          const fieldNames = Object.keys(entry.entryValues).filter(k => k !== 'company_name')
          addLog(`  Fields: ${fieldNames.join(', ')}`, 'detail')

          const result = await createNewAttioEntryAction({
            leadId: entry.leadId,
            leadName: entry.leadName,
            domain: entry.domain,
            entryValues: entry.entryValues,
          })

          if (result.ok) {
            addLog(`  Created successfully`, 'success')
            created++
          } else {
            addLog(`  FAILED: ${result.error}`, 'error')
            failed++
          }

          setStats({ created, updated, failed, total: totalWork })
        }

        addLog('')
      }

      // Phase 2: Update existing entries with mismatched fields
      if (compare.diffs.length > 0) {
        addLog(`Step ${compare.newEntries.length > 0 ? '3' : '2'}: Updating ${compare.diffs.length} entries with field differences...`)
        addLog('')

        for (let i = 0; i < compare.diffs.length; i++) {
          const entry = compare.diffs[i]
          progress++
          addLog(`[${progress}/${totalWork}/${totalLeads}] UPDATE "${entry.leadName}" — ${entry.diffs.length} field(s)`, 'warn')

          // Log each field difference with old vs new values
          for (const diff of entry.diffs) {
            addLog(`  ${diff.field}: "${diff.attio}" → "${diff.supabase}"`, 'detail')
          }

          const result = await updateSingleAttioEntryAction({
            leadId: entry.leadId,
            leadName: entry.leadName,
            recordId: entry.recordId,
            entryValues: entry.entryValues,
            changedFields: entry.diffs.map(d => d.field),
          })

          if (result.ok) {
            addLog(`  Synced`, 'success')
            updated++
          } else {
            addLog(`  FAILED: ${result.error}`, 'error')
            failed++
          }

          setStats({ created, updated, failed, total: totalWork })
        }
      }

      addLog('')
      addLog(`Sync complete — ${created} created, ${updated} updated, ${failed} failed`, 'done')
      router.refresh()
    } catch (err) {
      addLog(`Fatal error: ${err instanceof Error ? err.message : String(err)}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const colorMap: Record<LogType, string> = {
    info: 'text-zinc-300',
    success: 'text-green-400',
    error: 'text-red-400',
    warn: 'text-yellow-400',
    done: 'text-blue-400 font-bold',
    detail: 'text-zinc-500',
  }

  const progressText = () => {
    if (!loading) {
      if (!stats) return 'Done'
      return `${stats.total} processed — ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
    }
    if (!stats) return 'Comparing Supabase and Attio...'
    return `Progress: ${stats.created + stats.updated + stats.failed}/${stats.total} — ${stats.created} created, ${stats.updated} updated, ${stats.failed} failed`
  }

  return (
    <>
      <Button onClick={handleSync} disabled={loading} size="sm" variant="outline">
        {loading ? 'Syncing...' : 'Sync to Attio'}
      </Button>

      <Dialog open={open} onOpenChange={(value) => { if (loading && !value) return; setOpen(value) }}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" onPointerDownOutside={(e) => { if (loading) e.preventDefault() }} onEscapeKeyDown={(e) => { if (loading) e.preventDefault() }}>
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Syncing to Attio...' : 'Sync Complete'}
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
