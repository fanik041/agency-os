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
import { fetchAttioEntriesAction } from '@/app/leads/actions'

type AttioEntry = { company_name: string; values: Record<string, unknown> }

export function AttioViewerButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<string | null>(null)
  const [listName, setListName] = useState<string | null>(null)
  const [entries, setEntries] = useState<AttioEntry[]>([])

  async function handleFetch() {
    setLoading(true)
    setError(null)
    setEntries([])
    setOpen(true)

    try {
      const result = await fetchAttioEntriesAction()
      console.log('[attio-viewer] result:', result)
      if (!result.ok) {
        setError(result.error ?? 'Unknown error')
      } else {
        setWorkspace(result.workspace ?? null)
        setListName(result.listName ?? null)
        setEntries(result.entries)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button onClick={handleFetch} disabled={loading} size="sm" variant="outline">
        {loading ? 'Fetching...' : 'Attio Data'}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {loading ? 'Connecting to Attio...' : error ? 'Attio Error' : 'Attio Entries'}
            </DialogTitle>
            <DialogDescription>
              {loading
                ? 'Fetching data from Attio CRM...'
                : error
                  ? error
                  : `Workspace: ${workspace} — List: ${listName} — ${entries.length} entries`}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto min-h-0">
            {loading && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                Loading...
              </div>
            )}

            {!loading && !error && entries.length === 0 && (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                No entries found in list
              </div>
            )}

            {!loading && !error && entries.length > 0 && (
              <div className="space-y-3">
                {entries.map((entry, i) => (
                  <div key={i} className="border rounded-lg p-3">
                    <div className="font-medium mb-2">{entry.company_name}</div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      {Object.entries(entry.values).map(([key, val]) => (
                        <div key={key} className="flex gap-2">
                          <span className="font-medium text-foreground/70">{key}:</span>
                          <span className="truncate">{String(val ?? '')}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
